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
    const beneficioValidado = hardSoft.reduce(
      (s, m) => s + Number(m.valorRealizado),
      0,
    );
    const custoRealizado = projeto.custos.reduce(
      (s, c) => s + Number(c.valor),
      0,
    );

    const roi =
      custoRealizado === 0
        ? null
        : (beneficioValidado - custoRealizado) / custoRealizado;

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

    const prometido = beneficios
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

    const brr = prometido === 0 ? null : beneficioValidado / prometido;

    return {
      projetoId,
      nome: projeto.nome,
      beneficioValidado,
      custoRealizado,
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
      select: { id: true, nome: true, status: true },
    });
    const analytics = await Promise.all(
      projetos.map((p) => this.projetoAnalytics(p.id)),
    );
    const prometido = analytics.reduce((s, a) => s + a.prometido, 0);
    const realizado = analytics.reduce((s, a) => s + a.realizado, 0);
    const custo = analytics.reduce((s, a) => s + a.custoRealizado, 0);
    const hard = analytics.reduce((s, a) => s + a.porCategoria.hard, 0);
    const soft = analytics.reduce((s, a) => s + a.porCategoria.soft, 0);
    const roi =
      custo === 0 ? null : (realizado - custo) / custo;
    const emRisco = analytics.filter(
      (a) => a.brr !== null && a.brr < 0.7,
    ).length;

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
      porProjeto: analytics,
      curvaS,
    };
  }
}
