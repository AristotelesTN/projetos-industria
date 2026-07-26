import { Injectable } from '@nestjs/common';
import { MedicaoStatus } from '@prisma/client';
import { execFile } from 'child_process';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { promisify } from 'util';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';

const execFileAsync = promisify(execFile);

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  return [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(',')),
  ].join('\n');
}

@Injectable()
export class NaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  private naoRoot() {
    return resolve(
      process.env.NAO_PROJECT_PATH || join(process.cwd(), '..', 'nao'),
    );
  }

  status() {
    const root = this.naoRoot();
    const data = join(root, 'data');
    const db = join(root, 'oficina_valor.duckdb');
    return {
      projectPath: root,
      dataPath: data,
      duckdbExists: existsSync(db),
      configured: existsSync(join(root, 'nao_config.yaml')),
      engine: 'oficina-insights',
    };
  }

  async buildSnapshot() {
    const projetos = await this.prisma.projeto.findMany({
      include: {
        area: true,
        portfolio: true,
        sponsor: true,
        pm: true,
      },
    });
    const beneficios = await this.prisma.beneficio.findMany({
      include: { centroCusto: true, benefitOwner: true },
    });
    const baselines = await this.prisma.baseline.findMany();
    const medicoes = await this.prisma.medicao.findMany({
      where: { deletedAt: null },
      include: { validacao: true },
    });
    const custos = await this.prisma.custoRealizado.findMany();
    const gates = await this.prisma.gateDecisao.findMany();
    const portfolio = await this.analytics.portfolioResumo();

    const roiRows = portfolio.porProjeto.map((p) => ({
      projeto_id: p.projetoId,
      nome: p.nome,
      beneficio_validado: p.beneficioValidado,
      custo_realizado: p.custoRealizado,
      roi: p.roi ?? '',
      brr: p.brr ?? '',
      prometido: p.prometido,
    }));

    const curvaRows = portfolio.curvaS.map((c) => ({
      periodo: c.periodo,
      planejado_acumulado: c.planejadoAcumulado,
      realizado_acumulado: c.realizadoAcumulado,
      variancia_pct: c.varianciaPct ?? '',
    }));

    const fila = medicoes
      .filter((m) => m.status === MedicaoStatus.pendente_validacao)
      .map((m) => ({
        medicao_id: m.id,
        beneficio_id: m.beneficioId,
        periodo: m.periodoReferencia.toISOString().slice(0, 10),
        valor: Number(m.valorRealizado),
        registrada_em: m.registradaEm.toISOString(),
      }));

    const files: Record<string, string> = {
      'projetos.csv': toCsv(
        projetos.map((p) => ({
          id: p.id,
          nome: p.nome,
          status: p.status,
          area: p.area.nome,
          portfolio: p.portfolio.nome,
          sponsor: p.sponsor.email,
          pm: p.pm.email,
          investimento_aprovado: Number(p.investimentoAprovado),
        })),
      ),
      'beneficios.csv': toCsv(
        beneficios.map((b) => ({
          id: b.id,
          nome: b.nome,
          categoria: b.categoria,
          status: b.status,
          valor_mensal_esperado: Number(b.valorMensalEsperado),
          centro_custo: b.centroCusto?.codigo ?? '',
          benefit_owner: b.benefitOwner.email,
          janela_meses: b.janelaMeses,
        })),
      ),
      'baselines.csv': toCsv(
        baselines.map((b) => ({
          id: b.id,
          beneficio_id: b.beneficioId,
          valor_total: Number(b.valorTotalBaseline),
          versao: b.versao,
          vigente: b.vigente,
          congelada_em: b.congeladaEm?.toISOString() ?? '',
        })),
      ),
      'medicoes.csv': toCsv(
        medicoes.map((m) => ({
          id: m.id,
          beneficio_id: m.beneficioId,
          periodo: m.periodoReferencia.toISOString().slice(0, 10),
          valor_realizado: Number(m.valorRealizado),
          status: m.status,
          medicao_ajuste_id: m.medicaoAjusteId ?? '',
        })),
      ),
      'validacoes.csv': toCsv(
        medicoes
          .filter((m) => m.validacao)
          .map((m) => ({
            id: m.validacao!.id,
            medicao_id: m.id,
            decisao: m.validacao!.decisao,
            validada_em: m.validacao!.validadaEm.toISOString(),
          })),
      ),
      'custos_realizados.csv': toCsv(
        custos.map((c) => ({
          id: c.id,
          projeto_id: c.projetoId,
          periodo: c.periodoReferencia.toISOString().slice(0, 10),
          valor: Number(c.valor),
          origem: c.origem,
        })),
      ),
      'gates.csv': toCsv(
        gates.map((g) => ({
          id: g.id,
          projeto_id: g.projetoId,
          gate: g.gate,
          decisao: g.decisao,
          decidida_em: g.decididaEm.toISOString(),
        })),
      ),
      'roi_projeto.csv': toCsv(roiRows),
      'curva_s_mensal.csv': toCsv(curvaRows),
      'portfolio_resumo.csv': toCsv([
        {
          prometido: portfolio.prometido,
          realizado: portfolio.realizado,
          custo: portfolio.custo,
          roi: portfolio.roi ?? '',
          hard: portfolio.hard,
          soft: portfolio.soft,
          projetos_em_risco: portfolio.projetosEmRisco,
        },
      ]),
      'fila_homologacao.csv': toCsv(fila),
    };

    const manifesto = {
      generatedAt: new Date().toISOString(),
      counts: {
        projetos: projetos.length,
        beneficios: beneficios.length,
        medicoes: medicoes.length,
        fila: fila.length,
      },
      files: Object.keys(files),
    };

    return { files, manifesto };
  }

  /** Grava CSVs em nao/data e rebuilda o DuckDB (fonte do chat Nao). */
  async syncLocal() {
    const snap = await this.buildSnapshot();
    const root = this.naoRoot();
    const dataDir = join(root, 'data');
    mkdirSync(dataDir, { recursive: true });
    const written: string[] = [];
    for (const [name, content] of Object.entries(snap.files)) {
      writeFileSync(join(dataDir, name), content, 'utf8');
      written.push(name);
    }

    const buildScript = join(root, 'scripts', 'build_duckdb.py');
    let buildOk = false;
    let buildStdout = '';
    let buildStderr = '';
    if (existsSync(buildScript)) {
      try {
        const { stdout, stderr } = await execFileAsync(
          'python3',
          [buildScript],
          { cwd: root, timeout: 60000 },
        );
        buildOk = true;
        buildStdout = stdout;
        buildStderr = stderr;
      } catch (e: any) {
        buildOk = false;
        buildStdout = e.stdout?.toString?.() ?? '';
        buildStderr = e.stderr?.toString?.() ?? String(e);
      }
    } else {
      buildStderr = `Script não encontrado: ${buildScript}`;
    }

    const syncUrl = process.env.NAO_SYNC_URL;
    let remote: unknown = null;
    if (syncUrl) {
      try {
        const res = await fetch(syncUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            manifesto: snap.manifesto,
            files: snap.files,
          }),
        });
        remote = { ok: res.ok, body: await res.json().catch(() => ({})) };
      } catch (e) {
        remote = { ok: false, error: String(e) };
      }
    }

    return {
      mode: 'local-duckdb',
      ok: buildOk,
      manifesto: snap.manifesto,
      written,
      projectPath: root,
      duckdb: join(root, 'oficina_valor.duckdb'),
      buildStdout: buildStdout.slice(-2000),
      buildStderr: buildStderr.slice(-2000),
      remote,
      engine: 'oficina-insights',
    };
  }

  private fmtBrl(n: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(n);
  }

  /**
   * Insights nativo da Oficina (substitui o adaptador getnao/nao).
   * Retorna texto + tabela + chart/story quando aplicável.
   */
  async ask(question: string) {
    const q = (question || '').trim();
    if (!q) {
      return {
        answer: 'Faça uma pergunta sobre o portfólio.',
        rows: [],
        kind: 'empty',
      };
    }
    const lower = q.toLowerCase();
    if (/story|hist[oó]ria|relat[oó]rio|story\s*mode|painel executivo/.test(lower)) {
      return this.buildStory();
    }
    return this.answerIntent(lower);
  }

  async buildStory() {
    const portfolio = await this.analytics.portfolioResumo();
    const fmt = (n: number) => this.fmtBrl(n);
    const atRisk = portfolio.porProjeto.filter(
      (p) => p.brr != null && p.brr < 0.7,
    );
    const topRoi = [...portfolio.porProjeto]
      .filter((p) => p.roi != null)
      .sort((a, b) => Number(b.roi) - Number(a.roi))
      .slice(0, 5);
    const curva = (portfolio.curvaS || []).slice(-8);

    const pendentes = await this.prisma.medicao.count({
      where: { status: MedicaoStatus.pendente_validacao, deletedAt: null },
    });

    const story = {
      title: 'Story · Portfólio de Valor',
      generatedAt: new Date().toISOString(),
      sections: [
        {
          id: 'resumo',
          heading: 'Resumo executivo',
          text: `Prometido ${fmt(portfolio.prometido)} · realizado ${fmt(portfolio.realizado)} · ROI ${portfolio.roiLabel} · ${portfolio.projetosEmRisco} projeto(s) em risco · ${pendentes} medição(ões) na fila de homologação.`,
          chart: {
            type: 'kpi' as const,
            title: 'Indicadores',
            items: [
              { label: 'Prometido', value: portfolio.prometido, format: 'brl' },
              { label: 'Realizado', value: portfolio.realizado, format: 'brl' },
              {
                label: 'Em risco',
                value: portfolio.projetosEmRisco,
                format: 'number',
              },
              { label: 'Homologação', value: pendentes, format: 'number' },
            ],
          },
        },
        {
          id: 'categorias',
          heading: 'Hard vs soft',
          text: `Hard savings validados: ${fmt(portfolio.hard)}. Soft: ${fmt(portfolio.soft)}.`,
          chart: {
            type: 'pie' as const,
            title: 'Ganhos por categoria',
            series: [
              { label: 'Hard', value: Number(portfolio.hard) || 0 },
              { label: 'Soft', value: Number(portfolio.soft) || 0 },
            ].filter((s) => s.value > 0),
          },
          rows: [
            { categoria: 'hard', valor: fmt(portfolio.hard) },
            { categoria: 'soft', valor: fmt(portfolio.soft) },
          ],
        },
        {
          id: 'brr',
          heading: 'Saúde BRR',
          text:
            atRisk.length === 0
              ? 'Nenhum projeto abaixo de 70% de BRR.'
              : `${atRisk.length} projeto(s) com BRR abaixo de 70% — priorizar captura ou revisão de baseline.`,
          chart: {
            type: 'bar' as const,
            title: 'BRR por projeto (%)',
            series: portfolio.porProjeto
              .filter((p) => p.brr != null)
              .map((p) => ({
                label: p.nome,
                value: Math.round(Number(p.brr) * 100),
              })),
          },
          rows: atRisk.map((p) => ({
            projeto: p.nome,
            brr: `${Math.round(Number(p.brr) * 100)}%`,
            realizado: fmt(p.realizado),
          })),
        },
        {
          id: 'curva',
          heading: 'Curva S',
          text: 'Planejado vs realizado acumulado (últimos períodos).',
          chart: {
            type: 'line' as const,
            title: 'Curva S acumulada',
            series: curva.map((c) => ({
              label: c.periodo,
              planejado: c.planejadoAcumulado,
              realizado: c.realizadoAcumulado,
            })),
          },
          rows: curva.map((c) => ({
            periodo: c.periodo,
            planejado: fmt(c.planejadoAcumulado),
            realizado: fmt(c.realizadoAcumulado),
          })),
        },
        {
          id: 'roi',
          heading: 'Top ROI',
          text: 'Projetos com melhor retorno sobre investimento realizado.',
          chart: {
            type: 'bar' as const,
            title: 'ROI (múltiplo)',
            series: topRoi.map((p) => ({
              label: p.nome,
              value: Number(p.roi) || 0,
            })),
          },
          rows: topRoi.map((p) => ({
            projeto: p.nome,
            roi: p.roiLabel,
            realizado: fmt(p.realizado),
          })),
        },
      ],
    };

    return {
      answer: 'Story do portfólio gerada com KPIs, gráficos e tabelas.',
      kind: 'story',
      rows: [],
      story,
      source: 'analytics.portfolioResumo + medicoes',
    };
  }

  private async answerIntent(lower: string) {
    const portfolio = await this.analytics.portfolioResumo();
    const fmt = (n: number) => this.fmtBrl(n);

    if (/brr|risco|abaixo|sa[uú]de/.test(lower)) {
      const filtered = portfolio.porProjeto.filter(
        (p) => p.brr != null && p.brr < 0.7,
      );
      const rows = filtered
        .map((p) => ({
          projeto: p.nome,
          brr: `${Math.round(Number(p.brr) * 100)}%`,
          realizado: fmt(p.realizado),
          prometido: fmt(p.prometido),
        }))
        .sort((a, b) => a.brr.localeCompare(b.brr));
      return {
        answer: `${rows.length} projeto(s) com BRR abaixo de 70%.`,
        rows,
        kind: 'chart',
        chart: {
          type: 'bar' as const,
          title: 'BRR por projeto em risco (%)',
          series: filtered.map((p) => ({
            label: p.nome,
            value: Math.round(Number(p.brr) * 100),
          })),
        },
        source: 'roi_projeto / analytics',
      };
    }

    if (/hard|soft|categ|ganhos por/.test(lower)) {
      const hard = Number(portfolio.hard) || 0;
      const soft = Number(portfolio.soft) || 0;
      return {
        answer: `Hard savings validados: ${fmt(hard)}. Soft: ${fmt(soft)}.`,
        rows: [
          { categoria: 'hard', valor: fmt(hard) },
          { categoria: 'soft', valor: fmt(soft) },
        ],
        kind: 'chart',
        chart: {
          type: 'pie' as const,
          title: 'Ganhos por categoria',
          series: [
            { label: 'Hard', value: hard },
            { label: 'Soft', value: soft },
          ].filter((s) => s.value > 0),
        },
        source: 'portfolio_resumo',
      };
    }

    if (/curva\s*s|planejado|acumulad/.test(lower)) {
      const curva = (portfolio.curvaS || []).slice(-8);
      const rows = curva.map((c) => ({
        periodo: c.periodo,
        planejado: fmt(c.planejadoAcumulado),
        realizado: fmt(c.realizadoAcumulado),
        variancia:
          c.varianciaPct == null ? '—' : `${c.varianciaPct.toFixed(0)}%`,
      }));
      return {
        answer: 'Curva S consolidada (últimos períodos).',
        rows,
        kind: 'chart',
        chart: {
          type: 'line' as const,
          title: 'Curva S · planejado vs realizado',
          series: curva.map((c) => ({
            label: c.periodo,
            planejado: c.planejadoAcumulado,
            realizado: c.realizadoAcumulado,
          })),
        },
        source: 'curva_s_mensal',
      };
    }

    if (/fila|pendente|homolog/.test(lower)) {
      const pendentes = await this.prisma.medicao.findMany({
        where: { status: MedicaoStatus.pendente_validacao, deletedAt: null },
        include: {
          beneficio: {
            include: { businessCase: { include: { projeto: true } } },
          },
        },
        take: 20,
      });
      const rows = pendentes.map((m) => ({
        projeto: m.beneficio.businessCase.projeto.nome,
        beneficio: m.beneficio.nome,
        valor: fmt(Number(m.valorRealizado)),
        periodo: m.periodoReferencia.toISOString().slice(0, 10),
      }));
      return {
        answer: `${rows.length} medição(ões) na fila de homologação.`,
        rows,
        kind: 'table',
        chart: {
          type: 'kpi' as const,
          title: 'Fila',
          items: [
            { label: 'Pendentes', value: rows.length, format: 'number' },
            {
              label: 'Valor na fila',
              value: pendentes.reduce((s, m) => s + Number(m.valorRealizado), 0),
              format: 'brl',
            },
          ],
        },
        source: 'medicoes.pendente_validacao',
      };
    }

    if (/roi|top|retorno/.test(lower)) {
      const top = [...portfolio.porProjeto]
        .filter((p) => p.roi != null)
        .sort((a, b) => Number(b.roi) - Number(a.roi))
        .slice(0, 5);
      const rows = top.map((p) => ({
        projeto: p.nome,
        roi: p.roiLabel,
        realizado: fmt(p.realizado),
        custo: fmt(p.custoRealizado),
      }));
      return {
        answer: 'Top 5 projetos por ROI.',
        rows,
        kind: 'chart',
        chart: {
          type: 'bar' as const,
          title: 'Top ROI',
          series: top.map((p) => ({
            label: p.nome,
            value: Number(p.roi) || 0,
          })),
        },
        source: 'roi_projeto',
      };
    }

    return {
      answer: `Portfólio · prometido ${fmt(portfolio.prometido)}, realizado ${fmt(portfolio.realizado)}, ROI ${portfolio.roiLabel}, ${portfolio.projetosEmRisco} em risco.`,
      rows: portfolio.porProjeto.slice(0, 8).map((p) => ({
        projeto: p.nome,
        brr: p.brr == null ? '—' : `${Math.round(Number(p.brr) * 100)}%`,
        roi: p.roiLabel,
        realizado: fmt(p.realizado),
      })),
      kind: 'summary',
      chart: {
        type: 'kpi' as const,
        title: 'Portfólio',
        items: [
          { label: 'Prometido', value: portfolio.prometido, format: 'brl' },
          { label: 'Realizado', value: portfolio.realizado, format: 'brl' },
          {
            label: 'Em risco',
            value: portfolio.projetosEmRisco,
            format: 'number',
          },
        ],
      },
      hints: [
        'Quais projetos têm BRR abaixo de 70%?',
        'Compare hard vs soft savings validados no portfólio',
        'Mostre a curva S planejado vs realizado',
        'Liste medições pendentes na fila de homologação',
        'Top 5 projetos por ROI',
        'Gere um Story do portfólio com gráficos',
      ],
      source: 'portfolio_resumo',
    };
  }
}
