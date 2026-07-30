import { Injectable, NotFoundException } from '@nestjs/common';
import { BeneficioCategoria, MedicaoStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { formatYearMonth, monthStart } from '../common/dates';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async projetoAnalytics(projetoId: string) {
    const projeto = await this.prisma.projeto.findUnique({
      where: { id: projetoId },
      include: {
        custos: true,
        businessCase: {
          include: {
            beneficios: {
              include: {
                baselines: { where: { vigente: true } },
                medicoes: {
                  where: {
                    status: {
                      in: [MedicaoStatus.validada, MedicaoStatus.estornada],
                    },
                    deletedAt: null,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!projeto) throw new NotFoundException();

    const beneficios = projeto.businessCase?.beneficios ?? [];
    const medicoesValidas = beneficios.flatMap((b) =>
      b.medicoes.filter((m) => m.status === MedicaoStatus.validada),
    );

    const hardSoft = medicoesValidas.filter((m) => {
      const b = beneficios.find((x) => x.id === m.beneficioId)!;
      return (
        b.categoria === BeneficioCategoria.hard ||
        b.categoria === BeneficioCategoria.soft
      );
    });
    const beneficioValidadoMedicoes = hardSoft.reduce(
      (s, m) => s + Number(m.valorRealizado),
      0,
    );
    const economiaReal = Number(projeto.economiaRealAno ?? 0) || 0;
    const economiaEstimada = Number(projeto.economiaEstimadaAno ?? 0) || 0;
    const beneficioValidado =
      beneficioValidadoMedicoes > 0
        ? beneficioValidadoMedicoes
        : economiaReal;
    const custoRealizado = projeto.custos.reduce(
      (s, c) => s + Number(c.valor),
      0,
    );
    const investimentoRef =
      Number(
        projeto.investimentoCapex ??
          projeto.investimentoOpex ??
          projeto.investimentoAprovado ??
          0,
      ) || 0;
    const custoParaRoi =
      custoRealizado > 0 ? custoRealizado : investimentoRef;

    const roi =
      custoParaRoi === 0
        ? null
        : (beneficioValidado - custoParaRoi) / custoParaRoi;

    const plannedMap = new Map<string, number>();
    for (const b of beneficios) {
      if (
        b.categoria === BeneficioCategoria.estrategico ||
        b.categoria === BeneficioCategoria.avoidance
      ) {
        continue;
      }
      const bl = b.baselines[0];
      if (!bl) continue;
      const perfil = bl.perfilMensal as Record<string, number>;
      for (const [k, v] of Object.entries(perfil)) {
        plannedMap.set(k, (plannedMap.get(k) ?? 0) + Number(v));
      }
    }

    const actualMap = new Map<string, number>();
    for (const m of hardSoft) {
      const k = formatYearMonth(monthStart(m.periodoReferencia));
      actualMap.set(k, (actualMap.get(k) ?? 0) + Number(m.valorRealizado));
    }

    const months = Array.from(
      new Set([...plannedMap.keys(), ...actualMap.keys()]),
    ).sort();

    let accPlan = 0;
    let accAct = 0;
    const curvaS = months.map((m) => {
      accPlan += plannedMap.get(m) ?? 0;
      accAct += actualMap.get(m) ?? 0;
      const varianciaPct = accPlan === 0 ? null : (accAct / accPlan) * 100;
      return {
        periodo: m,
        planejadoAcumulado: accPlan,
        realizadoAcumulado: accAct,
        varianciaPct,
      };
    });

    const porCategoria: Record<string, number> = {
      hard: 0,
      soft: 0,
      avoidance: 0,
      estrategico: 0,
    };
    for (const m of medicoesValidas) {
      const b = beneficios.find((x) => x.id === m.beneficioId)!;
      porCategoria[b.categoria] =
        (porCategoria[b.categoria] ?? 0) + Number(m.valorRealizado);
    }

    const prometidoMedicoes = beneficios
      .filter(
        (b) =>
          b.categoria === BeneficioCategoria.hard ||
          b.categoria === BeneficioCategoria.soft,
      )
      .reduce(
        (s, b) =>
          s + Number(b.baselines[0]?.valorTotalBaseline ?? 0),
        0,
      );
    const prometido =
      prometidoMedicoes > 0
        ? prometidoMedicoes
        : economiaEstimada ||
          Number(projeto.ganhoFinanceiroAnual ?? 0) ||
          0;

    const brr = prometido === 0 ? null : beneficioValidado / prometido;

    return {
      projetoId,
      nome: projeto.nome,
      beneficioValidado,
      custoRealizado: custoParaRoi,
      roi,
      roiLabel:
        roi === null
          ? 'ROI não calculável'
          : `${(roi * 100).toFixed(1)}%`,
      brr,
      prometido,
      realizado: beneficioValidado,
      porCategoria,
      curvaS,
    };
  }

  async portfolioResumo() {
    const projetos = await this.prisma.projeto.findMany({
      select: {
        id: true,
        nome: true,
        status: true,
        ganhoPrincipal: true,
        ganhoQualitativoEscala: true,
        categoriaQualitativa: true,
        horasEconomizadasAno: true,
        ganhoFinanceiroAnual: true,
        riscoFinanceiroMitigadoAnual: true,
        ganhoNegocioAnual: true,
        ganhoRecorrente: true,
        excluirDoPotencialEstimado: true,
        investimentoCapex: true,
        investimentoOpex: true,
        investimentoCapexParaOpex: true,
        capexParaOpexAplicadoEm: true,
        investimentoAprovado: true,
        opexGerado: true,
        memoriaCalculoGanho: true,
        economiaEstimadaAno: true,
        economiaRealAno: true,
        diretoria: true,
        setor: true,
        escopoNegocio: true,
        inicioPrevisto: true,
        inicioReal: true,
        fimPrevisto: true,
        fimReal: true,
        updatedAt: true,
        area: { select: { nome: true } },
      },
    });
    const analytics = await Promise.all(
      projetos.map((p) => this.projetoAnalytics(p.id)),
    );
    const byId = new Map(projetos.map((p) => [p.id, p]));
    const prometido = analytics.reduce((s, a) => s + a.prometido, 0);
    const realizado = analytics.reduce((s, a) => s + a.realizado, 0);
    const custo = analytics.reduce((s, a) => s + a.custoRealizado, 0);
    const hardMed = analytics.reduce((s, a) => s + a.porCategoria.hard, 0);
    const soft = analytics.reduce((s, a) => s + a.porCategoria.soft, 0);
    const hard =
      hardMed > 0
        ? hardMed
        : analytics.reduce((s, a) => s + Number(a.realizado || 0), 0);
    const roi =
      custo === 0 ? null : (realizado - custo) / custo;
    const emRisco = analytics.filter(
      (a) => a.brr !== null && a.brr < 0.7,
    ).length;

    const n = (v: unknown) => {
      if (v == null) return 0;
      const x = Number(v);
      return Number.isNaN(x) ? 0 : x;
    };

    let potencialFinanceiro = 0;
    let potencialRisco = 0;
    let potencialNegocio = 0;
    let potencialHoras = 0;
    let potencialRecorrenteAnual = 0;
    let potencialPontual = 0;
    let qtdeRecorrentes = 0;
    let qtdePontuais = 0;
    let capex = 0;
    let opex = 0;
    let capexParaOpex = 0;
    let capexParaOpexPendente = 0;
    let capexParaOpexAplicado = 0;
    let qtdeQuantitativos = 0;
    let qtdeQualitativos = 0;
    const qualitativosPorCategoria: Record<string, number> = {};
    let ultimaAtualizacao: Date | null = null;

    let excluidosDoPotencial = 0;

    for (const p of projetos) {
      if (!ultimaAtualizacao || p.updatedAt > ultimaAtualizacao) {
        ultimaAtualizacao = p.updatedAt;
      }

      if (p.excluirDoPotencialEstimado) {
        excluidosDoPotencial += 1;
        continue;
      }

      const fin = n(p.ganhoFinanceiroAnual);
      const risco = n(p.riscoFinanceiroMitigadoAnual);
      const negocio = n(p.ganhoNegocioAnual);
      const horas = n(p.horasEconomizadasAno);
      potencialFinanceiro += fin;
      potencialRisco += risco;
      potencialNegocio += negocio;
      potencialHoras += horas;

      const monetario = fin + risco + negocio;
      const temGanhoDeclarado =
        monetario > 0 || horas > 0 || p.ganhoPrincipal != null;
      if (temGanhoDeclarado) {
        if (p.ganhoRecorrente) {
          qtdeRecorrentes += 1;
          potencialRecorrenteAnual += monetario;
        } else {
          qtdePontuais += 1;
          potencialPontual += monetario;
        }
      }

      capex += n(p.investimentoCapex ?? p.investimentoAprovado);
      opex += n(p.investimentoOpex ?? p.opexGerado);
      const planejadoCapexOpex = n(p.investimentoCapexParaOpex);
      capexParaOpex += planejadoCapexOpex;
      if (p.capexParaOpexAplicadoEm) {
        capexParaOpexAplicado += planejadoCapexOpex;
      } else {
        capexParaOpexPendente += planejadoCapexOpex;
      }

      const principal = p.ganhoPrincipal;
      if (principal === 'qualitativo') {
        qtdeQualitativos += 1;
        const cat = p.categoriaQualitativa || 'indefinido';
        qualitativosPorCategoria[cat] =
          (qualitativosPorCategoria[cat] ?? 0) + 1;
      } else if (principal) {
        qtdeQuantitativos += 1;
      }
    }

    const totalClassificados = qtdeQuantitativos + qtdeQualitativos;

    // curva S consolidada
    const mapPlan = new Map<string, number>();
    const mapAct = new Map<string, number>();
    for (const a of analytics) {
      let prevP = 0;
      let prevA = 0;
      for (const pt of a.curvaS) {
        const dP = pt.planejadoAcumulado - prevP;
        const dA = pt.realizadoAcumulado - prevA;
        mapPlan.set(pt.periodo, (mapPlan.get(pt.periodo) ?? 0) + dP);
        mapAct.set(pt.periodo, (mapAct.get(pt.periodo) ?? 0) + dA);
        prevP = pt.planejadoAcumulado;
        prevA = pt.realizadoAcumulado;
      }
    }
    const months = Array.from(
      new Set([...mapPlan.keys(), ...mapAct.keys()]),
    ).sort();
    let accP = 0;
    let accA = 0;
    const curvaS = months.map((m) => {
      accP += mapPlan.get(m) ?? 0;
      accA += mapAct.get(m) ?? 0;
      return {
        periodo: m,
        planejadoAcumulado: accP,
        realizadoAcumulado: accA,
        varianciaPct: accP === 0 ? null : (accA / accP) * 100,
      };
    });

    const porProjeto = analytics.map((a) => {
      const p = byId.get(a.projetoId);
      const anoRef = (() => {
        const d =
          p?.inicioReal ||
          p?.inicioPrevisto ||
          p?.fimReal ||
          p?.fimPrevisto ||
          null;
        if (!d) return null;
        return d.getFullYear();
      })();
      return {
        ...a,
        area: p?.area?.nome || 'Área',
        status: p?.status,
        diretoria: p?.diretoria ?? null,
        setor: p?.setor ?? null,
        escopoNegocio: p?.escopoNegocio ?? 'industrial',
        ano: anoRef,
        ganhoPrincipal: p?.ganhoPrincipal ?? null,
        ganhoFinanceiroAnual: p ? n(p.ganhoFinanceiroAnual) : null,
        riscoFinanceiroMitigadoAnual: p
          ? n(p.riscoFinanceiroMitigadoAnual)
          : null,
        ganhoNegocioAnual: p ? n(p.ganhoNegocioAnual) : null,
        horasEconomizadasAno: p ? n(p.horasEconomizadasAno) : null,
        ganhoRecorrente: p?.ganhoRecorrente ?? false,
        excluirDoPotencialEstimado: p?.excluirDoPotencialEstimado ?? false,
        investimentoCapex: p
          ? n(p.investimentoCapex ?? p.investimentoAprovado)
          : null,
        investimentoOpex: p ? n(p.investimentoOpex ?? p.opexGerado) : null,
        investimentoCapexParaOpex: p ? n(p.investimentoCapexParaOpex) : null,
        capexParaOpexAplicadoEm: p?.capexParaOpexAplicadoEm?.toISOString() ?? null,
        memoriaCalculoGanho: p?.memoriaCalculoGanho ?? null,
        economiaEstimadaAno: p ? n(p.economiaEstimadaAno) : null,
        economiaRealAno: p ? n(p.economiaRealAno) : null,
      };
    });

    const anos = Array.from(
      new Set(
        porProjeto
          .map((p) => p.ano)
          .filter((y): y is number => typeof y === 'number'),
      ),
    ).sort((a, b) => a - b);

    return {
      prometido,
      realizado,
      custo,
      roi,
      roiLabel:
        roi === null
          ? 'ROI não calculável'
          : `${(roi * 100).toFixed(1)}%`,
      hard,
      soft,
      projetosEmRisco: emRisco,
      porProjeto,
      curvaS,
      anos,
      potencial: {
        projetosQuantitativos: qtdeQuantitativos,
        projetosQualitativos: qtdeQualitativos,
        totalClassificados,
        pctQuantitativos:
          totalClassificados === 0
            ? null
            : (qtdeQuantitativos / totalClassificados) * 100,
        pctQualitativos:
          totalClassificados === 0
            ? null
            : (qtdeQualitativos / totalClassificados) * 100,
        ganhoFinanceiroAnual: potencialFinanceiro,
        riscoFinanceiroMitigadoAnual: potencialRisco,
        ganhoNegocioAnual: potencialNegocio,
        horasEconomizadasAno: potencialHoras,
        qualitativosPorCategoria,
        recorrente: {
          projetos: qtdeRecorrentes,
          anual: potencialRecorrenteAnual,
          horizonte3Anos: potencialRecorrenteAnual * 3,
        },
        pontual: {
          projetos: qtdePontuais,
          total: potencialPontual,
        },
        horizonte3Anos:
          potencialRecorrenteAnual * 3 + potencialPontual,
        excluidos: excluidosDoPotencial,
      },
      investimento: {
        capex,
        opex,
        capexParaOpex,
        capexParaOpexPendente,
        capexParaOpexAplicado,
      },
      atualizadoEm: ultimaAtualizacao?.toISOString() ?? new Date().toISOString(),
    };
  }

  /** Indicadores de custos PEP (SAP) agregados por ano / projeto. */
  async pepCustosResumo() {
    const n = (v: unknown) => {
      if (v == null) return 0;
      const x = Number(v);
      return Number.isNaN(x) ? 0 : x;
    };
    const anoFromCarteira = (carteira: string): number | null => {
      const parts = carteira.split('-');
      if (parts.length < 2) return null;
      const yy = Number(parts[1]);
      if (!Number.isFinite(yy)) return null;
      return yy >= 0 && yy < 100 ? 2000 + yy : yy;
    };

    const rows = await this.prisma.projetoPep.findMany({
      include: {
        projeto: {
          select: {
            id: true,
            nome: true,
            status: true,
            escopoNegocio: true,
            area: { select: { nome: true } },
          },
        },
      },
      orderBy: [{ carteira: 'asc' }, { codigoPep: 'asc' }],
    });

    const totais = {
      orcamento: 0,
      compromissadoTotal: 0,
      realizado: 0,
      comprometido: 0,
      disponivel: 0,
      peps: rows.length,
    };

    const porAnoMap = new Map<
      number,
      {
        ano: number;
        orcamento: number;
        compromissadoTotal: number;
        realizado: number;
        comprometido: number;
        disponivel: number;
        peps: number;
      }
    >();

    const porProjetoMap = new Map<
      string,
      {
        projetoId: string;
        nome: string;
        area: string;
        status: string;
        escopoNegocio: string;
        orcamento: number;
        compromissadoTotal: number;
        realizado: number;
        comprometido: number;
        disponivel: number;
        peps: Array<{
          codigoPep: string;
          carteira: string;
          ano: number | null;
          descricao: string | null;
          orcamento: number;
          compromissadoTotal: number;
          realizado: number;
          comprometido: number;
          disponivel: number;
        }>;
      }
    >();

    for (const r of rows) {
      const orcamento = n(r.orcamento);
      const compromissadoTotal = n(r.disposto);
      const realizado = n(r.real);
      const comprometido = n(r.comprometido);
      const disponivel = n(r.disponivel);
      const ano = anoFromCarteira(r.carteira);

      totais.orcamento += orcamento;
      totais.compromissadoTotal += compromissadoTotal;
      totais.realizado += realizado;
      totais.comprometido += comprometido;
      totais.disponivel += disponivel;

      if (ano != null) {
        const cur = porAnoMap.get(ano) || {
          ano,
          orcamento: 0,
          compromissadoTotal: 0,
          realizado: 0,
          comprometido: 0,
          disponivel: 0,
          peps: 0,
        };
        cur.orcamento += orcamento;
        cur.compromissadoTotal += compromissadoTotal;
        cur.realizado += realizado;
        cur.comprometido += comprometido;
        cur.disponivel += disponivel;
        cur.peps += 1;
        porAnoMap.set(ano, cur);
      }

      const pid = r.projetoId;
      const proj = porProjetoMap.get(pid) || {
        projetoId: pid,
        nome: r.projeto.nome,
        area: r.projeto.area?.nome || 'Área',
        status: r.projeto.status,
        escopoNegocio: r.projeto.escopoNegocio || 'industrial',
        orcamento: 0,
        compromissadoTotal: 0,
        realizado: 0,
        comprometido: 0,
        disponivel: 0,
        peps: [],
      };
      proj.orcamento += orcamento;
      proj.compromissadoTotal += compromissadoTotal;
      proj.realizado += realizado;
      proj.comprometido += comprometido;
      proj.disponivel += disponivel;
      proj.peps.push({
        codigoPep: r.codigoPep,
        carteira: r.carteira,
        ano,
        descricao: r.descricao,
        orcamento,
        compromissadoTotal,
        realizado,
        comprometido,
        disponivel,
      });
      porProjetoMap.set(pid, proj);
    }

    const porAno = Array.from(porAnoMap.values()).sort((a, b) => a.ano - b.ano);
    const porProjeto = Array.from(porProjetoMap.values()).sort(
      (a, b) => b.realizado - a.realizado,
    );

    const topRealizado = porProjeto.slice(0, 12).map((p) => ({
      projetoId: p.projetoId,
      nome: p.nome,
      valor: p.realizado,
    }));
    const topOrcamento = [...porProjeto]
      .sort((a, b) => b.orcamento - a.orcamento)
      .slice(0, 12)
      .map((p) => ({
        projetoId: p.projetoId,
        nome: p.nome,
        valor: p.orcamento,
      }));
    const consumo = porProjeto
      .filter((p) => p.orcamento > 0)
      .map((p) => ({
        projetoId: p.projetoId,
        nome: p.nome,
        pct: (p.realizado / p.orcamento) * 100,
        orcamento: p.orcamento,
        realizado: p.realizado,
      }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 12);

    return {
      totais,
      porAno,
      porProjeto,
      topRealizado,
      topOrcamento,
      consumo,
      anos: porAno.map((a) => a.ano),
    };
  }
}
