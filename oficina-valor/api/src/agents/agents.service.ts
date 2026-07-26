import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AgentCodigo,
  AgentMode,
  AgentRecoStatus,
  MedicaoStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { NaoService } from '../nao/nao.service';
import { AuthUser } from '../common/roles';

const AGENT_META: Record<
  Exclude<AgentCodigo, 'chief'>,
  { label: string; color: string; role: string }
> = {
  captura: {
    label: 'Captura',
    color: '#e56910',
    role: 'Sugere wizard e medições de ganho',
  },
  roi_auditor: {
    label: 'ROI Auditor',
    color: '#0c66e4',
    role: 'Audita ROI, custo e hard/soft',
  },
  curva_s: {
    label: 'Curva S',
    color: '#1d7afc',
    role: 'Detecta desvio planejado vs realizado',
  },
  risco: {
    label: 'Risco',
    color: '#22a06b',
    role: 'Monitora BRR, adoção e sem ganhos',
  },
  insights: {
    label: 'Insights',
    color: '#f5cd47',
    role: 'Converte anomalias em perguntas acionáveis',
  },
};

type Proposal = {
  agent: Exclude<AgentCodigo, 'chief'>;
  titulo: string;
  acaoProposta: string;
  projetoId?: string;
  confidence: number;
  reasoning: Record<string, unknown>;
  effect: Record<string, unknown>;
  riskLow: boolean;
};

@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly nao: NaoService,
  ) {}

  private async getMode(): Promise<AgentMode> {
    const cfg = await this.prisma.configVmo.findFirst();
    return cfg?.agentMode ?? AgentMode.assisted;
  }

  async setMode(mode: AgentMode) {
    const cfg = await this.prisma.configVmo.findFirst();
    if (!cfg) {
      return this.prisma.configVmo.create({ data: { agentMode: mode } });
    }
    return this.prisma.configVmo.update({
      where: { id: cfg.id },
      data: { agentMode: mode },
    });
  }

  private async nextCodigo() {
    const latest = await this.prisma.agentRecommendation.findMany({
      select: { codigo: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    let max = 100;
    for (const r of latest) {
      const n = Number(String(r.codigo).replace(/\D/g, ''));
      if (!Number.isNaN(n) && n > max) max = n;
    }
    return `REC-${max + 1}`;
  }

  private async logActivity(data: {
    agent: AgentCodigo;
    event: string;
    summary: string;
    recommendationId?: string;
    projetoId?: string;
    statusBadge?: string;
    detail?: Record<string, unknown>;
  }) {
    return this.prisma.agentActivity.create({
      data: {
        agent: data.agent,
        event: data.event,
        summary: data.summary,
        recommendationId: data.recommendationId,
        projetoId: data.projetoId,
        statusBadge: data.statusBadge,
        detail: (data.detail ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async scan(user?: AuthUser) {
    const mode = await this.getMode();
    const portfolio = await this.analytics.portfolioResumo();
    const projetos = await this.prisma.projeto.findMany({
      select: {
        id: true,
        nome: true,
        semGanhos: true,
        naoAdotado: true,
        wizardBaselineCompleto: true,
      },
    });
    const nomeById = new Map(projetos.map((p) => [p.id, p.nome]));
    const pendentes = await this.prisma.medicao.count({
      where: { status: MedicaoStatus.pendente_validacao, deletedAt: null },
    });

    const proposals: Proposal[] = [];

    for (const p of portfolio.porProjeto) {
      const brr = p.brr;
      const nome = p.nome;

      if (brr != null && brr < 0.7) {
        proposals.push({
          agent: 'captura',
          titulo: `Acelerar captura · ${nome}`,
          acaoProposta: `Abrir Wizard de realização para registrar ganhos em ${nome} (BRR ${(brr * 100).toFixed(0)}%).`,
          projetoId: p.projetoId,
          confidence: brr < 0.4 ? 94 : 86,
          riskLow: brr >= 0.4,
          reasoning: {
            summary: `${nome} está com BRR abaixo da meta de 70%.`,
            inputs: [
              `BRR atual: ${(brr * 100).toFixed(0)}%`,
              `Realizado: ${p.realizado}`,
              `Prometido: ${p.prometido}`,
            ],
            logic:
              'Projetos com BRR < 70% devem priorizar medições na janela de savings via wizard pós-entrega.',
          },
          effect: {
            type: 'open_wizard',
            projetoId: p.projetoId,
            wizardTipo: 'realizacao',
          },
        });
      }

      if (p.roi != null && (p.roi < 0.2 || p.custoRealizado > p.prometido * 0.8)) {
        proposals.push({
          agent: 'roi_auditor',
          titulo: `Auditar ROI · ${nome}`,
          acaoProposta: `Revisar custo vs benefício em ${nome} (ROI ${p.roiLabel}).`,
          projetoId: p.projetoId,
          confidence: p.roi < 0 ? 96 : 88,
          riskLow: (p.roi ?? 0) >= 0,
          reasoning: {
            summary: `ROI ${p.roiLabel} com custo ${p.custoRealizado} vs benefício ${p.beneficioValidado}.`,
            inputs: [
              `ROI: ${p.roiLabel}`,
              `Custo realizado: ${p.custoRealizado}`,
              `Benefício validado: ${p.beneficioValidado}`,
            ],
            logic:
              'Quando ROI < 20% ou custo se aproxima da baseline, o auditor recomenda revisão de Finanças antes de novas decisões de gate.',
          },
          effect: {
            type: 'select_project',
            projetoId: p.projetoId,
            message: `Revisar ROI de ${nome}`,
          },
        });
      }

      if (brr != null && brr < 0.4) {
        proposals.push({
          agent: 'risco',
          titulo: `Risco de valor · ${nome}`,
          acaoProposta: `Priorizar intervenção — ${nome} com BRR crítico (${(brr * 100).toFixed(0)}%).`,
          projetoId: p.projetoId,
          confidence: 92,
          riskLow: false,
          reasoning: {
            summary: 'BRR crítico indica valor em risco no portfólio.',
            inputs: [`BRR: ${(brr * 100).toFixed(0)}%`, `Status health: delayed`],
            logic:
              'BRR < 40% dispara agente de risco; se não adotado, encaminha wizard de verificação de adoção.',
          },
          effect: {
            type: 'open_wizard',
            projetoId: p.projetoId,
            wizardTipo: 'realizacao',
            priority: true,
          },
        });
      }
    }

    for (const proj of projetos.filter((p) => p.naoAdotado || p.semGanhos)) {
      proposals.push({
        agent: 'risco',
        titulo: `Sem ganhos / não adotado · ${proj.nome}`,
        acaoProposta: `Reavaliar adoção de ${proj.nome} no Wizard de realização.`,
        projetoId: proj.id,
        confidence: 95,
        riskLow: false,
        reasoning: {
          summary: proj.naoAdotado
            ? 'Projeto marcado como não adotado.'
            : 'Projeto marcado SEM GANHOS.',
          inputs: [
            `naoAdotado: ${proj.naoAdotado}`,
            `semGanhos: ${proj.semGanhos}`,
          ],
          logic: 'RF-26a exige causa e trilha; supervisor deve reabrir verificação de adoção.',
        },
        effect: {
          type: 'open_wizard',
          projetoId: proj.id,
          wizardTipo: 'realizacao',
        },
      });
    }

    const curva = portfolio.curvaS || [];
    if (curva.length) {
      const last = curva[curva.length - 1];
      const varPct = last.varianciaPct;
      if (varPct != null && varPct < 50) {
        proposals.push({
          agent: 'curva_s',
          titulo: 'Desvio na Curva S consolidada',
          acaoProposta: `Captura em ${varPct.toFixed(0)}% do planejado — abrir Insights da anomalia.`,
          confidence: 90,
          riskLow: varPct >= 35,
          reasoning: {
            summary: 'Realizado acumulado muito abaixo do planejado.',
            inputs: [
              `Período: ${last.periodo}`,
              `Planejado: ${last.planejadoAcumulado}`,
              `Realizado: ${last.realizadoAcumulado}`,
              `Variância: ${varPct.toFixed(0)}%`,
            ],
            logic:
              'Curva S com variância < 50% sugere acelerar medições e revisar baselines vigentes.',
          },
          effect: {
            type: 'open_insights',
            prompt: 'Mostre a curva S planejado vs realizado',
          },
        });
      }
    }

    if (portfolio.projetosEmRisco >= 3) {
      proposals.push({
        agent: 'insights',
        titulo: 'Anomalia de portfólio · BRR',
        acaoProposta: `Consultar Insights: ${portfolio.projetosEmRisco} projetos em risco.`,
        confidence: 91,
        riskLow: true,
        reasoning: {
          summary: 'Concentração de projetos abaixo da meta BRR.',
          inputs: [
            `Em risco: ${portfolio.projetosEmRisco}`,
            `ROI portfólio: ${portfolio.roiLabel}`,
            `Pendentes homologação: ${pendentes}`,
          ],
          logic:
            'O agente Insights materializa a anomalia como pergunta pronta no chat nativo.',
        },
        effect: {
          type: 'open_insights',
          prompt: 'Quais projetos têm BRR abaixo de 70%?',
        },
      });
    }

    if (pendentes > 0) {
      proposals.push({
        agent: 'captura',
        titulo: 'Fila de medições pendentes',
        acaoProposta: `${pendentes} medição(ões) aguardando validação — priorizar homologação via Wizard/Insights.`,
        confidence: 85,
        riskLow: true,
        reasoning: {
          summary: 'Há medições em pendente_validacao.',
          inputs: [`Pendentes: ${pendentes}`],
          logic: 'Captura incompleta enquanto a fila de validação cresce.',
        },
        effect: {
          type: 'open_insights',
          prompt: 'Liste medições pendentes na fila de homologação',
        },
      });
    }

    // Dedup: keep highest confidence per agent+projetoId+titulo prefix
    const seen = new Set<string>();
    const unique = proposals
      .sort((a, b) => b.confidence - a.confidence)
      .filter((p) => {
        const key = `${p.agent}:${p.projetoId ?? 'port'}:${p.titulo.slice(0, 40)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 20);

    // Clear old pending before rescan (keep resolved history)
    await this.prisma.agentRecommendation.deleteMany({
      where: { status: AgentRecoStatus.pending },
    });

    const created = [];
    for (const p of unique) {
      const codigo = await this.nextCodigo();
      let status: AgentRecoStatus = AgentRecoStatus.pending;
      let resolvedAt: Date | null = null;
      if (mode === AgentMode.automated && p.confidence >= 90 && p.riskLow) {
        status = AgentRecoStatus.auto;
        resolvedAt = new Date();
      }

      const rec = await this.prisma.agentRecommendation.create({
        data: {
          agent: p.agent,
          codigo,
          titulo: p.titulo,
          acaoProposta: p.acaoProposta,
          projetoId: p.projetoId,
          confidence: p.confidence,
          reasoning: p.reasoning as Prisma.InputJsonValue,
          effect: p.effect as Prisma.InputJsonValue,
          status,
          mode,
          resolvedAt,
          resolvedById:
            status === AgentRecoStatus.auto ? user?.id ?? null : null,
        },
      });
      created.push(rec);

      await this.logActivity({
        agent: p.agent,
        event: status === AgentRecoStatus.auto ? 'auto' : 'propose',
        summary: p.acaoProposta,
        recommendationId: rec.id,
        projetoId: p.projetoId,
        statusBadge: status === AgentRecoStatus.auto ? 'Auto' : 'Pending',
        detail: {
          confidence: p.confidence,
          reasoning: p.reasoning,
          projetoNome: p.projetoId ? nomeById.get(p.projetoId) : null,
        },
      });
    }

    await this.logActivity({
      agent: AgentCodigo.chief,
      event: 'scan',
      summary: `Chief orquestrou scan · ${created.length} recomendações (${mode})`,
      statusBadge: 'Auto',
      detail: { count: created.length, mode },
    });

    return { mode, created: created.length, recommendations: created };
  }

  async overview() {
    const mode = await this.getMode();
    let pending = await this.prisma.agentRecommendation.count({
      where: { status: AgentRecoStatus.pending },
    });
    if (pending === 0) {
      const total = await this.prisma.agentRecommendation.count();
      if (total === 0) {
        await this.scan();
        pending = await this.prisma.agentRecommendation.count({
          where: { status: AgentRecoStatus.pending },
        });
      }
    }

    const [accepted, rejected, auto, actions, recent, recs, projetos] =
      await Promise.all([
        this.prisma.agentRecommendation.count({
          where: { status: AgentRecoStatus.accepted },
        }),
        this.prisma.agentRecommendation.count({
          where: { status: AgentRecoStatus.rejected },
        }),
        this.prisma.agentRecommendation.count({
          where: { status: AgentRecoStatus.auto },
        }),
        this.prisma.agentRecommendation.count(),
        this.prisma.agentActivity.findMany({
          orderBy: { createdAt: 'desc' },
          take: 12,
        }),
        this.prisma.agentRecommendation.findMany({
          where: { status: AgentRecoStatus.pending },
          include: { projeto: { select: { id: true, nome: true } } },
          orderBy: { confidence: 'desc' },
          take: 50,
        }),
        this.prisma.projeto.findMany({
          select: { id: true, nome: true, naoAdotado: true, semGanhos: true },
        }),
      ]);

    const decided = accepted + rejected + auto;
    const successPct =
      decided === 0 ? 0 : Math.round(((accepted + auto) / decided) * 100);

    const byAgent = (Object.keys(AGENT_META) as (keyof typeof AGENT_META)[]).map(
      (code) => ({
        codigo: code,
        ...AGENT_META[code],
        pending: recs.filter((r) => r.agent === code).length,
        actions: recent.filter((a) => a.agent === code).length,
      }),
    );

    // Live status dots: map projects to dominant agent color
    const liveDots = projetos.map((p, idx) => {
      const related = recs.find((r) => r.projetoId === p.id);
      const agent = (related?.agent ??
        (p.naoAdotado || p.semGanhos
          ? 'risco'
          : (['captura', 'roi_auditor', 'curva_s', 'risco', 'insights'] as const)[
              idx % 5
            ])) as keyof typeof AGENT_META;
      return {
        projetoId: p.id,
        nome: p.nome,
        agent,
        color: AGENT_META[agent].color,
      };
    });

    return {
      mode,
      kpis: {
        actions,
        successPct,
        awaiting: pending,
        auto,
      },
      hierarchy: {
        chief: {
          codigo: 'chief',
          label: 'Chief AI',
          color: '#0c66e4',
          role: 'Orquestra especialistas · Agents propose; you approve',
        },
        specialists: byAgent,
      },
      liveDots,
      recentActions: recent,
      agents: AGENT_META,
    };
  }

  async listRecommendations(filters?: {
    agent?: AgentCodigo;
    status?: AgentRecoStatus;
  }) {
    return this.prisma.agentRecommendation.findMany({
      where: {
        agent: filters?.agent,
        status: filters?.status,
      },
      include: {
        projeto: { select: { id: true, nome: true, area: true } },
      },
      orderBy: [{ status: 'asc' }, { confidence: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  async activity(filters?: { agent?: AgentCodigo; statusBadge?: string }) {
    return this.prisma.agentActivity.findMany({
      where: {
        agent: filters?.agent,
        statusBadge: filters?.statusBadge,
      },
      orderBy: { createdAt: 'desc' },
      take: 80,
    });
  }

  async getRecommendation(id: string) {
    const r = await this.prisma.agentRecommendation.findUnique({
      where: { id },
      include: {
        projeto: { select: { id: true, nome: true, area: true } },
      },
    });
    if (!r) throw new NotFoundException('Recomendação não encontrada');
    return r;
  }

  async accept(id: string, user: AuthUser) {
    const rec = await this.getRecommendation(id);
    if (
      rec.status !== AgentRecoStatus.pending &&
      rec.status !== AgentRecoStatus.auto
    ) {
      throw new UnprocessableEntityException('Recomendação já resolvida');
    }

    const effect = rec.effect as Record<string, unknown>;
    let effectResult: Record<string, unknown> = { ...effect };

    if (effect.type === 'open_insights' && typeof effect.prompt === 'string') {
      const answer = await this.nao.ask(effect.prompt);
      effectResult = { ...effect, insightsAnswer: answer };
    }

    const updated = await this.prisma.agentRecommendation.update({
      where: { id },
      data: {
        status: AgentRecoStatus.accepted,
        resolvedAt: new Date(),
        resolvedById: user.id,
        effect: effectResult as Prisma.InputJsonValue,
      },
      include: { projeto: { select: { id: true, nome: true } } },
    });

    await this.logActivity({
      agent: rec.agent,
      event: 'accept',
      summary: `Aceito: ${rec.acaoProposta}`,
      recommendationId: rec.id,
      projetoId: rec.projetoId ?? undefined,
      statusBadge: 'Accepted',
      detail: {
        confidence: rec.confidence,
        effect: effectResult,
        reasoning: rec.reasoning,
      },
    });

    return {
      recommendation: updated,
      navigation: this.navigationFromEffect(effectResult),
    };
  }

  async reject(id: string, user: AuthUser) {
    const rec = await this.getRecommendation(id);
    if (rec.status !== AgentRecoStatus.pending) {
      throw new UnprocessableEntityException('Recomendação já resolvida');
    }
    const updated = await this.prisma.agentRecommendation.update({
      where: { id },
      data: {
        status: AgentRecoStatus.rejected,
        resolvedAt: new Date(),
        resolvedById: user.id,
      },
      include: { projeto: { select: { id: true, nome: true } } },
    });
    await this.logActivity({
      agent: rec.agent,
      event: 'reject',
      summary: `Rejeitado: ${rec.acaoProposta}`,
      recommendationId: rec.id,
      projetoId: rec.projetoId ?? undefined,
      statusBadge: 'Rejected',
      detail: { confidence: rec.confidence },
    });
    return { recommendation: updated };
  }

  private navigationFromEffect(effect: Record<string, unknown>) {
    if (effect.type === 'open_wizard') {
      return {
        tab: 'wizard',
        projetoId: effect.projetoId,
        wizardTipo: effect.wizardTipo ?? 'realizacao',
      };
    }
    if (effect.type === 'open_insights') {
      return { tab: 'nao', prompt: effect.prompt };
    }
    if (effect.type === 'select_project') {
      return {
        tab: 'diretoria',
        projetoId: effect.projetoId,
        message: effect.message,
      };
    }
    return { tab: 'agents' };
  }
}
