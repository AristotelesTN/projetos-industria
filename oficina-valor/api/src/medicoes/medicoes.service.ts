import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  BeneficioCategoria,
  MedicaoStatus,
  PapelCodigo,
  Prisma,
} from '@prisma/client';
import { createWriteStream, mkdirSync } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthUser, hasAnyRole } from '../common/roles';
import { addMonths, monthStart } from '../common/dates';

@Injectable()
export class MedicoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private uploadDir() {
    const dir = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  async criar(
    beneficioId: string,
    input: { periodoReferencia: string; valorRealizado: number; comentario?: string },
    user: AuthUser,
  ) {
    const beneficio = await this.prisma.beneficio.findUnique({
      where: { id: beneficioId },
      include: {
        businessCase: { include: { projeto: true } },
        baselines: { where: { vigente: true } },
      },
    });
    if (!beneficio) throw new NotFoundException('Benefício não encontrado');
    if (beneficio.status === 'cancelado') {
      throw new UnprocessableEntityException('Benefício cancelado');
    }
    if (beneficio.capturaPausada) {
      throw new UnprocessableEntityException('Captura pausada (Hold)');
    }
    if (
      !hasAnyRole(user, [PapelCodigo.ADMIN]) &&
      user.id !== beneficio.benefitOwnerId &&
      user.id !== beneficio.businessCase.projeto.pmId
    ) {
      throw new ForbiddenException('Somente PM ou benefit owner');
    }

    let periodo = monthStart(input.periodoReferencia);
    const fechado = await this.prisma.periodoFechado.findUnique({
      where: { periodo },
    });
    if (fechado) {
      // RF-10f: retroativo vira ajuste no período corrente
      const agora = monthStart(new Date());
      periodo = agora;
    }

    try {
      const medicao = await this.prisma.medicao.create({
        data: {
          beneficioId,
          periodoReferencia: periodo,
          valorRealizado: input.valorRealizado,
          status: MedicaoStatus.rascunho,
          registradaPorId: user.id,
          comentario: input.comentario,
        },
      });
      await this.auditoria.log({
        entidade: 'Medicao',
        entidadeId: medicao.id,
        acao: 'create',
        usuarioId: user.id,
        valorNovo: medicao,
      });
      return medicao;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'Já existe medição para este benefício e período',
        );
      }
      throw e;
    }
  }

  async anexarEvidencia(
    medicaoId: string,
    file: Express.Multer.File,
    user: AuthUser,
  ) {
    const medicao = await this.prisma.medicao.findUnique({
      where: { id: medicaoId },
      include: { evidencias: true },
    });
    if (!medicao || medicao.deletedAt) throw new NotFoundException();
    const editaveis: MedicaoStatus[] = [
      MedicaoStatus.rascunho,
      MedicaoStatus.rejeitada,
    ];
    if (!editaveis.includes(medicao.status)) {
      throw new ConflictException('Medição não aceita novas evidências');
    }
    const versao = medicao.evidencias.length + 1;
    const filename = `${medicaoId}-v${versao}-${file.originalname}`;
    const caminho = join(this.uploadDir(), filename);
    await pipeline(
      require('stream').Readable.from(file.buffer),
      createWriteStream(caminho),
    );
    const ev = await this.prisma.evidencia.create({
      data: {
        medicaoId,
        nomeArquivo: file.originalname,
        caminho,
        versao,
        mimeType: file.mimetype,
      },
    });
    await this.auditoria.log({
      entidade: 'Evidencia',
      entidadeId: ev.id,
      acao: 'upload',
      usuarioId: user.id,
      valorNovo: { nomeArquivo: ev.nomeArquivo, versao },
    });
    return ev;
  }

  async submeter(medicaoId: string, user: AuthUser) {
    const medicao = await this.prisma.medicao.findUnique({
      where: { id: medicaoId },
      include: {
        evidencias: true,
        beneficio: true,
      },
    });
    if (!medicao || medicao.deletedAt) throw new NotFoundException();
    if (medicao.registradaPorId !== user.id && !hasAnyRole(user, [PapelCodigo.ADMIN])) {
      throw new ForbiddenException();
    }
    if (
      medicao.beneficio.categoria === BeneficioCategoria.hard &&
      medicao.evidencias.length === 0
    ) {
      throw new UnprocessableEntityException(
        'Hard saving exige evidência anexada',
      );
    }
    const updated = await this.prisma.medicao.update({
      where: { id: medicaoId },
      data: { status: MedicaoStatus.pendente_validacao },
    });
    await this.auditoria.log({
      entidade: 'Medicao',
      entidadeId: medicaoId,
      acao: 'submeter',
      usuarioId: user.id,
    });
    return updated;
  }

  async validar(
    medicaoId: string,
    decisao: 'aprovada' | 'rejeitada',
    comentario: string | undefined,
    user: AuthUser,
  ) {
    if (!hasAnyRole(user, [PapelCodigo.FINANCAS])) {
      throw new ForbiddenException('Somente Finanças valida');
    }
    const medicao = await this.prisma.medicao.findUnique({
      where: { id: medicaoId },
      include: { beneficio: true },
    });
    if (!medicao || medicao.deletedAt) throw new NotFoundException();
    if (medicao.status !== MedicaoStatus.pendente_validacao) {
      throw new ConflictException('Medição não está pendente');
    }
    if (medicao.registradaPorId === user.id) {
      throw new ForbiddenException('Segregação de funções: registrador ≠ validador');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const status =
        decisao === 'aprovada'
          ? MedicaoStatus.validada
          : MedicaoStatus.rejeitada;
      const m = await tx.medicao.update({
        where: { id: medicaoId },
        data: { status },
      });
      const v = await tx.validacao.create({
        data: {
          medicaoId,
          validadaPorId: user.id,
          decisao,
          comentario,
        },
      });
      // RF-08: janela — se passou, marca incorporado
      if (decisao === 'aprovada' && medicao.beneficio.inicioCaptura) {
        const fimJanela = addMonths(
          monthStart(medicao.beneficio.inicioCaptura),
          medicao.beneficio.janelaMeses,
        );
        if (monthStart(new Date()) >= fimJanela) {
          await tx.beneficio.update({
            where: { id: medicao.beneficioId },
            data: { status: 'incorporado' },
          });
        }
      }
      return { medicao: m, validacao: v };
    });

    await this.auditoria.log({
      entidade: 'Validacao',
      entidadeId: result.validacao.id,
      acao: decisao,
      usuarioId: user.id,
      valorNovo: { medicaoId, comentario },
    });
    return result;
  }

  async estornar(
    medicaoId: string,
    justificativa: string,
    user: AuthUser,
  ) {
    if (!hasAnyRole(user, [PapelCodigo.FINANCAS])) {
      throw new ForbiddenException('Somente Finanças estorna');
    }
    if (!justificativa?.trim()) {
      throw new UnprocessableEntityException('Justificativa obrigatória');
    }
    const original = await this.prisma.medicao.findUnique({
      where: { id: medicaoId },
    });
    if (!original || original.deletedAt) throw new NotFoundException();
    if (original.status !== MedicaoStatus.validada) {
      throw new ConflictException('Só medições validadas podem ser estornadas');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const estornada = await tx.medicao.update({
        where: { id: medicaoId },
        data: { status: MedicaoStatus.estornada },
      });
      // Ajuste no período corrente com valor inverso
      const periodoCorrente = monthStart(new Date());
      let periodoAjuste = periodoCorrente;
      const existing = await tx.medicao.findUnique({
        where: {
          beneficioId_periodoReferencia: {
            beneficioId: original.beneficioId,
            periodoReferencia: periodoCorrente,
          },
        },
      });
      if (existing && existing.id !== original.id) {
        // se já há medição no corrente, usa sufixo via comentário e força unique bypass
        // criando no próximo mês livre
        let probe = periodoCorrente;
        for (let i = 0; i < 24; i++) {
          const hit = await tx.medicao.findUnique({
            where: {
              beneficioId_periodoReferencia: {
                beneficioId: original.beneficioId,
                periodoReferencia: probe,
              },
            },
          });
          if (!hit) {
            periodoAjuste = probe;
            break;
          }
          probe = addMonths(probe, 1);
        }
      }
      const ajuste = await tx.medicao.create({
        data: {
          beneficioId: original.beneficioId,
          periodoReferencia: periodoAjuste,
          valorRealizado: Number(original.valorRealizado) * -1,
          status: MedicaoStatus.validada,
          medicaoAjusteId: original.id,
          registradaPorId: user.id,
          comentario: `Estorno: ${justificativa}`,
        },
      });
      await tx.validacao.create({
        data: {
          medicaoId: ajuste.id,
          validadaPorId: user.id,
          decisao: 'aprovada',
          comentario: justificativa,
        },
      });
      return { estornada, ajuste };
    });

    await this.auditoria.log({
      entidade: 'Medicao',
      entidadeId: medicaoId,
      acao: 'estorno',
      usuarioId: user.id,
      valorNovo: {
        ajusteId: result.ajuste.id,
        justificativa,
      },
    });
    return result;
  }

  filaPendentes() {
    return this.prisma.medicao.findMany({
      where: {
        status: MedicaoStatus.pendente_validacao,
        deletedAt: null,
      },
      include: {
        beneficio: {
          include: {
            centroCusto: true,
            businessCase: { include: { projeto: true } },
          },
        },
        evidencias: true,
        registradaPor: { select: { id: true, nome: true, email: true } },
      },
      orderBy: { registradaEm: 'asc' },
    });
  }

  async fecharPeriodo(periodoRef: string, user: AuthUser) {
    if (!hasAnyRole(user, [PapelCodigo.FINANCAS, PapelCodigo.ADMIN])) {
      throw new ForbiddenException();
    }
    const periodo = monthStart(periodoRef);
    const created = await this.prisma.periodoFechado.upsert({
      where: { periodo },
      update: {},
      create: {
        periodo,
        publicadoPorId: user.id,
      },
    });
    await this.auditoria.log({
      entidade: 'PeriodoFechado',
      entidadeId: created.id,
      acao: 'publicar',
      usuarioId: user.id,
      valorNovo: { periodo },
    });
    return created;
  }
}
