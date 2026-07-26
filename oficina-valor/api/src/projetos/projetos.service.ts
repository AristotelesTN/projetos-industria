import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { BeneficioCategoria, ProjetoStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthUser } from '../common/roles';
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

  list(_user: AuthUser) {
    return this.prisma.projeto.findMany({
      where: {},
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

  async get(id: string, _user: AuthUser) {
    const projeto = await this.prisma.projeto.findFirst({
      where: { id },
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

  /** Criação enxuta para o board do Portfólio (gerente). */
  async createRapido(
    input: {
      nome: string;
      areaNome: string;
      investimento?: number;
      prazoMeses?: number;
      problema?: string;
      valorMensalEsperado?: number;
      status?: ProjetoStatus;
    },
    user: AuthUser,
  ) {
    const investimento = Number(input.investimento ?? 100000);
    const prazoMeses = Number(input.prazoMeses ?? 12);
    const valorMensal = Number(input.valorMensalEsperado ?? 5000);
    return this.create(
      {
        nome: input.nome.trim(),
        areaNome: input.areaNome.trim() || 'Geral',
        sponsorId: user.id,
        pmId: user.id,
        investimento,
        prazoMeses,
        problema:
          input.problema?.trim() ||
          `Business case inicial — ${input.nome.trim()}`,
        beneficios: [
          {
            nome: `Ganho estimado — ${input.nome.trim()}`,
            categoria: BeneficioCategoria.soft,
            valorMensalEsperado: valorMensal,
            benefitOwnerId: user.id,
            janelaMeses: prazoMeses,
          },
        ],
      },
      user,
    ).then(async (created) => {
      if (input.status && input.status !== ProjetoStatus.conceito) {
        return this.updateStatus(created.id, input.status, user);
      }
      return created;
    });
  }

  async updateStatus(id: string, status: ProjetoStatus, user: AuthUser) {
    const before = await this.prisma.projeto.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Projeto não encontrado');
    const updated = await this.prisma.projeto.update({
      where: { id },
      data: { status },
    });
    await this.auditoria.log({
      entidade: 'Projeto',
      entidadeId: id,
      acao: 'status_change',
      usuarioId: user.id,
      valorAnterior: { status: before.status },
      valorNovo: { status },
    });
    return this.get(updated.id, user);
  }

  async remove(id: string, user: AuthUser) {
    const projeto = await this.prisma.projeto.findUnique({
      where: { id },
      include: {
        businessCase: {
          include: {
            beneficios: {
              include: {
                baselines: true,
                medicoes: { include: { evidencias: true, validacao: true } },
              },
            },
          },
        },
      },
    });
    if (!projeto) throw new NotFoundException('Projeto não encontrado');

    await this.prisma.$transaction(async (tx) => {
      await tx.agentRecommendation.deleteMany({ where: { projetoId: id } });
      await tx.wizardSessao.deleteMany({ where: { projetoId: id } });
      await tx.gateDecisao.deleteMany({ where: { projetoId: id } });
      await tx.custoRealizado.deleteMany({ where: { projetoId: id } });
      await tx.historicoResponsavel.deleteMany({ where: { projetoId: id } });

      const beneficios = projeto.businessCase?.beneficios ?? [];
      for (const b of beneficios) {
        for (const m of b.medicoes) {
          await tx.evidencia.deleteMany({ where: { medicaoId: m.id } });
          if (m.validacao) {
            await tx.validacao.delete({ where: { id: m.validacao.id } });
          }
        }
        await tx.medicao.deleteMany({ where: { beneficioId: b.id } });
        await tx.baseline.deleteMany({ where: { beneficioId: b.id } });
        await tx.historicoResponsavel.deleteMany({ where: { beneficioId: b.id } });
        await tx.beneficio.delete({ where: { id: b.id } });
      }
      if (projeto.businessCase) {
        await tx.businessCase.delete({ where: { id: projeto.businessCase.id } });
      }
      await tx.projeto.delete({ where: { id } });
    });

    await this.auditoria.log({
      entidade: 'Projeto',
      entidadeId: id,
      acao: 'delete',
      usuarioId: user.id,
      valorAnterior: { nome: projeto.nome, status: projeto.status },
    });

    return { ok: true, id, nome: projeto.nome };
  }
}
