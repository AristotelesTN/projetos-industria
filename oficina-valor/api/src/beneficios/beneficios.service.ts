import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PapelCodigo } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthUser, hasAnyRole } from '../common/roles';
import { buildPerfilMensal, monthStart } from '../common/dates';

@Injectable()
export class BeneficiosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async get(id: string) {
    const b = await this.prisma.beneficio.findUnique({
      where: { id },
      include: {
        baselines: { orderBy: { versao: 'desc' } },
        centroCusto: true,
        benefitOwner: true,
        businessCase: { include: { projeto: true } },
      },
    });
    if (!b) throw new NotFoundException();
    return b;
  }

  async criarBaselineProposta(
    beneficioId: string,
    user: AuthUser,
    input?: { valorMensalEsperado?: number; janelaMeses?: number },
  ) {
    const b = await this.get(beneficioId);
    const vigente = b.baselines.find((x) => x.vigente);
    if (vigente && b.businessCase.projeto.status === 'execucao') {
      throw new ConflictException(
        'Baseline congelada — use Recycle de gate para nova versão',
      );
    }
    const maxVersao = b.baselines.reduce((m, x) => Math.max(m, x.versao), 0);
    const valorMensal = Number(
      input?.valorMensalEsperado ?? b.valorMensalEsperado,
    );
    const janela = input?.janelaMeses ?? b.janelaMeses;
    const inicio = monthStart(b.inicioCaptura ?? new Date());
    const created = await this.prisma.baseline.create({
      data: {
        beneficioId,
        valorTotalBaseline: valorMensal * janela,
        perfilMensal: buildPerfilMensal(inicio, janela, valorMensal),
        versao: maxVersao + 1,
        vigente: false,
      },
    });
    await this.auditoria.log({
      entidade: 'Baseline',
      entidadeId: created.id,
      acao: 'create_proposta',
      usuarioId: user.id,
      valorNovo: created,
    });
    return created;
  }

  async reatribuirOwner(
    beneficioId: string,
    novoOwnerId: string,
    user: AuthUser,
    motivo?: string,
  ) {
    if (!hasAnyRole(user, [PapelCodigo.ADMIN, PapelCodigo.VMO_LEAD])) {
      throw new ForbiddenException();
    }
    const b = await this.get(beneficioId);
    await this.prisma.$transaction([
      this.prisma.beneficio.update({
        where: { id: beneficioId },
        data: { benefitOwnerId: novoOwnerId },
      }),
      this.prisma.historicoResponsavel.create({
        data: {
          beneficioId,
          projetoId: b.businessCase.projetoId,
          tipo: 'benefit_owner',
          anteriorId: b.benefitOwnerId,
          novoId: novoOwnerId,
          motivo,
        },
      }),
    ]);
    await this.auditoria.log({
      entidade: 'Beneficio',
      entidadeId: beneficioId,
      acao: 'reatribuir_owner',
      usuarioId: user.id,
      valorAnterior: { benefitOwnerId: b.benefitOwnerId },
      valorNovo: { benefitOwnerId: novoOwnerId, motivo },
    });
    return this.get(beneficioId);
  }

  async marcarIncorporado(beneficioId: string, user: AuthUser) {
    const b = await this.get(beneficioId);
    if (!b.inicioCaptura) {
      throw new UnprocessableEntityException('Sem início de captura');
    }
    const updated = await this.prisma.beneficio.update({
      where: { id: beneficioId },
      data: { status: 'incorporado' },
    });
    await this.auditoria.log({
      entidade: 'Beneficio',
      entidadeId: beneficioId,
      acao: 'incorporado',
      usuarioId: user.id,
    });
    return updated;
  }
}
