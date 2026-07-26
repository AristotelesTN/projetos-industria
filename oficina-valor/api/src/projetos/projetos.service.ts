import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  BeneficioCategoria,
  PapelCodigo,
  Prisma,
  ProjetoStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthUser, hasAnyRole } from '../common/roles';
import { buildPerfilMensal, monthStart } from '../common/dates';
import { ConfigService } from '../config/config.service';

export type BeneficioInput = {
  nome: string;
  categoria: BeneficioCategoria;
  centroCustoCodigo?: string;
  valorMensalEsperado: number;
  escalaEstrategica?: number;
  inicioCaptura?: string;
  janelaMeses?: number;
  benefitOwnerId: string;
};

@Injectable()
export class ProjetosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly config: ConfigService,
  ) {}

  private scopeWhere(user: AuthUser): Prisma.ProjetoWhereInput {
    if (
      hasAnyRole(user, [
        PapelCodigo.ADMIN,
        PapelCodigo.VMO_LEAD,
        PapelCodigo.FINANCAS,
        PapelCodigo.DIRETORIA,
      ])
    ) {
      return {};
    }
    return {
      OR: [{ pmId: user.id }, { sponsorId: user.id }],
    };
  }

  list(user: AuthUser) {
    return this.prisma.projeto.findMany({
      where: this.scopeWhere(user),
      include: {
        area: true,
        portfolio: true,
        sponsor: { select: { id: true, nome: true, email: true } },
        pm: { select: { id: true, nome: true, email: true } },
        businessCase: {
          include: {
            beneficios: {
              include: {
                baselines: { where: { vigente: true } },
                centroCusto: true,
              },
            },
          },
        },
      },
      orderBy: { nome: 'asc' },
    });
  }

  async get(id: string, user: AuthUser) {
    const projeto = await this.prisma.projeto.findFirst({
      where: { id, ...this.scopeWhere(user) },
      include: {
        area: true,
        portfolio: true,
        sponsor: true,
        pm: true,
        businessCase: {
          include: {
            beneficios: {
              include: {
                baselines: { orderBy: { versao: 'desc' } },
                centroCusto: true,
                benefitOwner: {
                  select: { id: true, nome: true, email: true },
                },
                medicoes: {
                  where: { deletedAt: null },
                  include: { evidencias: true, validacao: true },
                  orderBy: { periodoReferencia: 'desc' },
                },
              },
            },
          },
        },
        gates: {
          include: {
            decididaPor: { select: { id: true, nome: true, email: true } },
          },
          orderBy: { decididaEm: 'desc' },
        },
        custos: { orderBy: { periodoReferencia: 'desc' } },
      },
    });
    if (!projeto) throw new NotFoundException('Projeto não encontrado');
    return projeto;
  }

  async create(
    input: {
      nome: string;
      portfolioNome?: string;
      areaNome: string;
      sponsorId: string;
      pmId: string;
      investimento: number;
      prazoMeses: number;
      problema: string;
      inicioPrevisto?: string;
      fimPrevisto?: string;
      beneficios: BeneficioInput[];
    },
    user: AuthUser,
  ) {
    if (
      !hasAnyRole(user, [
        PapelCodigo.ADMIN,
        PapelCodigo.VMO_LEAD,
        PapelCodigo.PM,
      ])
    ) {
      throw new ForbiddenException();
    }
    if (!input.beneficios?.length) {
      throw new UnprocessableEntityException(
        'Business case exige ≥1 benefício quantificado',
      );
    }
    for (const b of input.beneficios) {
      if (b.categoria === 'hard' && !b.centroCustoCodigo) {
        throw new UnprocessableEntityException(
          'Hard saving exige centro de custo',
        );
      }
      if (b.categoria === 'estrategico' && !b.escalaEstrategica) {
        throw new UnprocessableEntityException(
          'Valor estratégico exige escala 1-5',
        );
      }
      if (b.categoria !== 'estrategico' && Number(b.valorMensalEsperado) <= 0) {
        throw new UnprocessableEntityException(
          'Benefício financeiro precisa de valor mensal > 0',
        );
      }
    }

    const cfg = await this.config.get();
    const portfolioNome = input.portfolioNome ?? 'Portfólio Principal';
    let portfolio = await this.prisma.portfolio.findFirst({
      where: { nome: portfolioNome },
    });
    if (!portfolio) {
      portfolio = await this.prisma.portfolio.create({
        data: { nome: portfolioNome },
      });
    }
    const portfolioId = portfolio.id;

    const area = await this.prisma.area.upsert({
      where: { nome: input.areaNome },
      update: {},
      create: { nome: input.areaNome },
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const projeto = await tx.projeto.create({
        data: {
          nome: input.nome,
          portfolioId,
          areaId: area.id,
          sponsorId: input.sponsorId,
          pmId: input.pmId,
          status: ProjetoStatus.conceito,
          investimentoAprovado: input.investimento,
          inicioPrevisto: input.inicioPrevisto
            ? new Date(input.inicioPrevisto)
            : null,
          fimPrevisto: input.fimPrevisto ? new Date(input.fimPrevisto) : null,
          businessCase: {
            create: {
              problema: input.problema,
              investimento: input.investimento,
              prazoMeses: input.prazoMeses,
              submetido: false,
            },
          },
        },
        include: { businessCase: true },
      });

      for (const b of input.beneficios) {
        let centroCustoId: string | undefined;
        if (b.centroCustoCodigo) {
          const cc = await tx.centroCusto.upsert({
            where: { codigo: b.centroCustoCodigo },
            update: {},
            create: {
              codigo: b.centroCustoCodigo,
              nome: b.centroCustoCodigo,
            },
          });
          centroCustoId = cc.id;
        }
        const janela = b.janelaMeses ?? cfg.janelaSavingsPadrao;
        const inicio = monthStart(b.inicioCaptura ?? new Date());
        const valorMensal = Number(b.valorMensalEsperado);
        const beneficio = await tx.beneficio.create({
          data: {
            businessCaseId: projeto.businessCase!.id,
            nome: b.nome,
            categoria: b.categoria,
            centroCustoId,
            valorMensalEsperado: valorMensal,
            escalaEstrategica: b.escalaEstrategica,
            inicioCaptura: inicio,
            janelaMeses: janela,
            benefitOwnerId: b.benefitOwnerId,
            status: 'planejado',
          },
        });
        const perfil = buildPerfilMensal(inicio, janela, valorMensal);
        await tx.baseline.create({
          data: {
            beneficioId: beneficio.id,
            valorTotalBaseline: valorMensal * janela,
            perfilMensal: perfil,
            versao: 1,
            vigente: false,
          },
        });
      }

      return projeto;
    });

    await this.auditoria.log({
      entidade: 'Projeto',
      entidadeId: created.id,
      acao: 'create',
      usuarioId: user.id,
      valorNovo: { nome: created.nome },
    });

    return this.get(created.id, user);
  }

  async submeterBusinessCase(id: string, user: AuthUser) {
    const projeto = await this.get(id, user);
    const bens = projeto.businessCase?.beneficios ?? [];
    if (!bens.length) {
      throw new UnprocessableEntityException(
        'Business case exige ≥1 benefício',
      );
    }
    for (const b of bens) {
      if (!b.baselines.length) {
        throw new UnprocessableEntityException(
          `Benefício ${b.nome} sem baseline proposta`,
        );
      }
    }
    await this.prisma.businessCase.update({
      where: { id: projeto.businessCase!.id },
      data: { submetido: true },
    });
    await this.auditoria.log({
      entidade: 'BusinessCase',
      entidadeId: projeto.businessCase!.id,
      acao: 'submit',
      usuarioId: user.id,
    });
    return this.get(id, user);
  }

  async preValidarPremissas(
    id: string,
    ok: boolean,
    user: AuthUser,
    comentario?: string,
  ) {
    if (!hasAnyRole(user, [PapelCodigo.FINANCAS, PapelCodigo.ADMIN])) {
      throw new ForbiddenException();
    }
    const projeto = await this.prisma.projeto.update({
      where: { id },
      data: { premissasOkFinancas: ok },
    });
    await this.auditoria.log({
      entidade: 'Projeto',
      entidadeId: id,
      acao: ok ? 'premissas_ok' : 'premissas_rejeitadas',
      usuarioId: user.id,
      valorNovo: { comentario },
    });
    return projeto;
  }

  async reatribuirPm(id: string, novoPmId: string, user: AuthUser, motivo?: string) {
    if (!hasAnyRole(user, [PapelCodigo.ADMIN, PapelCodigo.VMO_LEAD])) {
      throw new ForbiddenException();
    }
    const projeto = await this.prisma.projeto.findUniqueOrThrow({
      where: { id },
    });
    await this.prisma.$transaction([
      this.prisma.projeto.update({
        where: { id },
        data: { pmId: novoPmId },
      }),
      this.prisma.historicoResponsavel.create({
        data: {
          projetoId: id,
          tipo: 'pm',
          anteriorId: projeto.pmId,
          novoId: novoPmId,
          motivo,
        },
      }),
    ]);
    await this.auditoria.log({
      entidade: 'Projeto',
      entidadeId: id,
      acao: 'reatribuir_pm',
      usuarioId: user.id,
      valorAnterior: { pmId: projeto.pmId },
      valorNovo: { pmId: novoPmId, motivo },
    });
    return this.get(id, user);
  }
}
