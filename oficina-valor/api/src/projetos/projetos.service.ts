import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  BeneficioCategoria,
  CategoriaQualitativaGanho,
  GanhoPrincipalTipo,
  GateDecisaoTipo,
  GateTipo,
  PapelEstrategicoFapd,
  ProjetoStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthUser } from '../common/roles';
import { buildPerfilMensal, monthStart } from '../common/dates';
import { ConfigService } from '../config/config.service';

export type AvaliacaoFapdInput = {
  notaOe1?: number | null;
  notaOe3?: number | null;
  notaOe4?: number | null;
  notaOe5Sust?: number | null;
  notaOe5Tech?: number | null;
  naOe1?: boolean;
  naOe3?: boolean;
  naOe4?: boolean;
  naOe5Sust?: boolean;
  naOe5Tech?: boolean;
  papelEstrategico?: PapelEstrategicoFapd | null;
  comentarioFapd?: string | null;
};

function clampNota(n: number | null | undefined): number | null {
  if (n == null || Number.isNaN(Number(n))) return null;
  const v = Math.round(Number(n));
  if (v < 0 || v > 5) {
    throw new UnprocessableEntityException('Notas OE devem estar entre 0 e 5');
  }
  return v;
}

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

    const n = (v: unknown) => {
      if (v == null || v === '') return 0;
      const x = Number(v);
      return Number.isNaN(x) ? 0 : x;
    };

    const isImplementado = (s: ProjetoStatus) =>
      s === ProjetoStatus.encerrado || s === ProjetoStatus.sustentacao;

    const data: {
      status: ProjetoStatus;
      acompanhamentoPosPendente?: boolean;
      finalizadoEm?: Date | null;
      investimentoCapex?: number;
      investimentoOpex?: number;
      investimentoAprovado?: number;
      opexGerado?: number;
      capexParaOpexAplicadoEm?: Date;
    } = { status };

    if (status === ProjetoStatus.encerrado && before.status !== ProjetoStatus.encerrado) {
      data.acompanhamentoPosPendente = true;
      data.finalizadoEm = new Date();
    }
    if (
      status !== ProjetoStatus.encerrado &&
      before.status === ProjetoStatus.encerrado
    ) {
      data.acompanhamentoPosPendente = false;
      data.finalizadoEm = null;
    }

    // US: após implementação, valor planejado de CAPEX migra para OPEX (uma vez).
    let capexOpexTransfer: number | null = null;
    if (
      isImplementado(status) &&
      !isImplementado(before.status) &&
      !before.capexParaOpexAplicadoEm
    ) {
      const planned = n(before.investimentoCapexParaOpex);
      if (planned > 0) {
        const capexAtual = n(
          before.investimentoCapex ?? before.investimentoAprovado,
        );
        const opexAtual = n(before.investimentoOpex ?? before.opexGerado);
        const novoCapex = Math.max(0, capexAtual - planned);
        const novoOpex = opexAtual + planned;
        data.investimentoCapex = novoCapex;
        data.investimentoOpex = novoOpex;
        data.investimentoAprovado = novoCapex;
        data.opexGerado = novoOpex;
        data.capexParaOpexAplicadoEm = new Date();
        capexOpexTransfer = planned;
      }
    }

    const updated = await this.prisma.projeto.update({
      where: { id },
      data,
    });
    await this.auditoria.log({
      entidade: 'Projeto',
      entidadeId: id,
      acao: 'status_change',
      usuarioId: user.id,
      valorAnterior: {
        status: before.status,
        investimentoCapex: before.investimentoCapex,
        investimentoOpex: before.investimentoOpex,
        capexParaOpexAplicadoEm: before.capexParaOpexAplicadoEm,
      },
      valorNovo: {
        status,
        acompanhamentoPosPendente: data.acompanhamentoPosPendente,
        capexParaOpexTransferido: capexOpexTransfer,
        investimentoCapex: data.investimentoCapex,
        investimentoOpex: data.investimentoOpex,
        capexParaOpexAplicadoEm: data.capexParaOpexAplicadoEm,
      },
    });
    return this.get(updated.id, user);
  }

  /** Decisão go/no-go leve no projeto (US-89) — sem exigir G2 completo. */
  async decidirGoNoGo(
    id: string,
    input: {
      decisao: 'aprovado' | 'reprovado';
      justificativa?: string | null;
    },
    user: AuthUser,
  ) {
    const before = await this.prisma.projeto.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Projeto não encontrado');
    if (input.decisao === 'reprovado' && !input.justificativa?.trim()) {
      throw new BadRequestException(
        'Justificativa obrigatória para reprovação',
      );
    }
    const status =
      input.decisao === 'aprovado'
        ? ProjetoStatus.aprovado
        : ProjetoStatus.morto;
    const updated = await this.prisma.projeto.update({
      where: { id },
      data: {
        status,
        justificativaDecisao: input.justificativa?.trim() || null,
      },
    });
    await this.prisma.gateDecisao.create({
      data: {
        projetoId: id,
        gate: GateTipo.G2,
        decisao:
          input.decisao === 'aprovado'
            ? GateDecisaoTipo.go
            : GateDecisaoTipo.kill,
        decididaPorId: user.id,
        comentario: input.justificativa?.trim() || null,
      },
    });
    await this.auditoria.log({
      entidade: 'Projeto',
      entidadeId: id,
      acao: 'decidir_go_nogo',
      usuarioId: user.id,
      valorAnterior: { status: before.status },
      valorNovo: { status, decisao: input.decisao },
    });
    return this.get(updated.id, user);
  }

  async marcarAcompanhamentoPosFeito(id: string, user: AuthUser) {
    const before = await this.prisma.projeto.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Projeto não encontrado');
    const updated = await this.prisma.projeto.update({
      where: { id },
      data: { acompanhamentoPosPendente: false },
    });
    await this.auditoria.log({
      entidade: 'Projeto',
      entidadeId: id,
      acao: 'acompanhamento_pos_feito',
      usuarioId: user.id,
      valorAnterior: { acompanhamentoPosPendente: before.acompanhamentoPosPendente },
      valorNovo: { acompanhamentoPosPendente: false },
    });
    return this.get(updated.id, user);
  }

  /** Avaliação FAPD mínima: 5 OEs (0–5 ou N/A) + papel + comentário. */
  async updateAvaliacaoFapd(
    id: string,
    input: AvaliacaoFapdInput,
    user: AuthUser,
  ) {
    const before = await this.prisma.projeto.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Projeto não encontrado');

    const naOe1 = Boolean(input.naOe1);
    const naOe3 = Boolean(input.naOe3);
    const naOe4 = Boolean(input.naOe4);
    const naOe5Sust = Boolean(input.naOe5Sust);
    const naOe5Tech = Boolean(input.naOe5Tech);

    const data = {
      notaOe1: naOe1 ? null : clampNota(input.notaOe1),
      notaOe3: naOe3 ? null : clampNota(input.notaOe3),
      notaOe4: naOe4 ? null : clampNota(input.notaOe4),
      notaOe5Sust: naOe5Sust ? null : clampNota(input.notaOe5Sust),
      notaOe5Tech: naOe5Tech ? null : clampNota(input.notaOe5Tech),
      naOe1,
      naOe3,
      naOe4,
      naOe5Sust,
      naOe5Tech,
      papelEstrategico:
        input.papelEstrategico === undefined
          ? before.papelEstrategico
          : input.papelEstrategico,
      comentarioFapd:
        input.comentarioFapd === undefined
          ? before.comentarioFapd
          : input.comentarioFapd?.trim() || null,
    };

    await this.prisma.projeto.update({ where: { id }, data });
    await this.auditoria.log({
      entidade: 'Projeto',
      entidadeId: id,
      acao: 'avaliacao_fapd',
      usuarioId: user.id,
      valorAnterior: {
        notaOe1: before.notaOe1,
        notaOe3: before.notaOe3,
        notaOe4: before.notaOe4,
        notaOe5Sust: before.notaOe5Sust,
        notaOe5Tech: before.notaOe5Tech,
        naOe1: before.naOe1,
        naOe3: before.naOe3,
        naOe4: before.naOe4,
        naOe5Sust: before.naOe5Sust,
        naOe5Tech: before.naOe5Tech,
        papelEstrategico: before.papelEstrategico,
        comentarioFapd: before.comentarioFapd,
      },
      valorNovo: data,
    });
    return this.get(id, user);
  }

  /** Potencial de ganhos + investimento + memória (painel de valor). */
  async updateValorPotencial(
    id: string,
    input: {
      memoriaCalculoGanho?: string | null;
      comentarios?: string | null;
      opexGerado?: number | null;
      ganhoPrincipal?: GanhoPrincipalTipo | null;
      ganhoQualitativoEscala?: number | null;
      categoriaQualitativa?: CategoriaQualitativaGanho | null;
      horasEconomizadasAno?: number | null;
      ganhoFinanceiroAnual?: number | null;
      riscoFinanceiroMitigadoAnual?: number | null;
      ganhoNegocioAnual?: number | null;
      ganhoRecorrente?: boolean;
      investimentoCapex?: number | null;
      investimentoOpex?: number | null;
      investimentoCapexParaOpex?: number | null;
    },
    user: AuthUser,
  ) {
    const before = await this.prisma.projeto.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Projeto não encontrado');

    const money = (v: unknown, fallback: unknown) => {
      if (v === undefined) return fallback;
      if (v == null || v === '') return null;
      const n = Number(v);
      return Number.isNaN(n) ? null : Math.max(0, n);
    };

    const ganhoFinanceiroAnual = money(
      input.ganhoFinanceiroAnual,
      before.ganhoFinanceiroAnual,
    ) as number | null;
    const riscoFinanceiroMitigadoAnual = money(
      input.riscoFinanceiroMitigadoAnual,
      before.riscoFinanceiroMitigadoAnual,
    ) as number | null;
    const ganhoNegocioAnual = money(
      input.ganhoNegocioAnual,
      before.ganhoNegocioAnual,
    ) as number | null;
    const horasEconomizadasAno = money(
      input.horasEconomizadasAno,
      before.horasEconomizadasAno,
    ) as number | null;
    const opexGerado = money(input.opexGerado, before.opexGerado) as
      | number
      | null;
    const investimentoCapex = money(
      input.investimentoCapex,
      before.investimentoCapex,
    ) as number | null;
    const investimentoOpex = money(
      input.investimentoOpex,
      before.investimentoOpex,
    ) as number | null;
    const investimentoCapexParaOpex = money(
      input.investimentoCapexParaOpex,
      before.investimentoCapexParaOpex,
    ) as number | null;

    let ganhoQualitativoEscala =
      input.ganhoQualitativoEscala === undefined
        ? before.ganhoQualitativoEscala
        : input.ganhoQualitativoEscala == null
          ? null
          : Math.round(Number(input.ganhoQualitativoEscala));
    if (ganhoQualitativoEscala != null) {
      if (ganhoQualitativoEscala < 1 || ganhoQualitativoEscala > 7) {
        throw new BadRequestException(
          'Escala qualitativa deve estar entre 1 e 7',
        );
      }
    }

    const ganhoPrincipal =
      input.ganhoPrincipal === undefined
        ? before.ganhoPrincipal
        : input.ganhoPrincipal;
    const categoriaQualitativa =
      input.categoriaQualitativa === undefined
        ? before.categoriaQualitativa
        : input.categoriaQualitativa;
    const memoriaCalculoGanho =
      input.memoriaCalculoGanho === undefined
        ? before.memoriaCalculoGanho
        : input.memoriaCalculoGanho?.trim() || null;

    const temGanhoDeclarado =
      (ganhoFinanceiroAnual ?? 0) > 0 ||
      (riscoFinanceiroMitigadoAnual ?? 0) > 0 ||
      (ganhoNegocioAnual ?? 0) > 0 ||
      (horasEconomizadasAno ?? 0) > 0 ||
      ganhoQualitativoEscala != null;

    if (temGanhoDeclarado && !memoriaCalculoGanho?.trim()) {
      throw new BadRequestException(
        'Informe o racional / memória de cálculo quando houver ganhos declarados',
      );
    }

    if (ganhoPrincipal === GanhoPrincipalTipo.qualitativo) {
      if (ganhoQualitativoEscala == null) {
        throw new BadRequestException(
          'Informe a escala 1–7 para ganho qualitativo principal',
        );
      }
      if (!categoriaQualitativa) {
        throw new BadRequestException(
          'Informe a categoria do ganho qualitativo',
        );
      }
    }

    const data = {
      memoriaCalculoGanho,
      comentarios:
        input.comentarios === undefined
          ? before.comentarios
          : input.comentarios?.trim() || null,
      opexGerado,
      ganhoPrincipal,
      ganhoQualitativoEscala,
      categoriaQualitativa,
      horasEconomizadasAno,
      ganhoFinanceiroAnual,
      riscoFinanceiroMitigadoAnual,
      ganhoNegocioAnual,
      ganhoRecorrente:
        input.ganhoRecorrente === undefined
          ? before.ganhoRecorrente
          : Boolean(input.ganhoRecorrente),
      investimentoCapex,
      investimentoOpex,
      investimentoCapexParaOpex,
      // Mantém investimentoAprovado alinhado ao CAPEX quando informado
      investimentoAprovado:
        investimentoCapex != null
          ? investimentoCapex
          : before.investimentoAprovado,
    };

    await this.prisma.projeto.update({ where: { id }, data });
    await this.auditoria.log({
      entidade: 'Projeto',
      entidadeId: id,
      acao: 'valor_potencial',
      usuarioId: user.id,
      valorAnterior: {
        ganhoPrincipal: before.ganhoPrincipal,
        ganhoFinanceiroAnual: before.ganhoFinanceiroAnual,
        investimentoCapex: before.investimentoCapex,
        memoriaCalculoGanho: before.memoriaCalculoGanho,
      },
      valorNovo: {
        ganhoPrincipal: data.ganhoPrincipal,
        ganhoFinanceiroAnual: data.ganhoFinanceiroAnual,
        investimentoCapex: data.investimentoCapex,
        memoriaCalculoGanho: data.memoriaCalculoGanho,
      },
    });
    return this.get(id, user);
  }

  /** Memória de cálculo do ganho + comentários + OPEX gerado. */
  async updateAnotacoes(
    id: string,
    input: {
      memoriaCalculoGanho?: string | null;
      comentarios?: string | null;
      opexGerado?: number | null;
    },
    user: AuthUser,
  ) {
    return this.updateValorPotencial(id, input, user);
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
      await tx.demanda.updateMany({
        where: { projetoId: id },
        data: { projetoId: null },
      });
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
