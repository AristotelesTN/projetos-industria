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
    const chatUrl = process.env.NAO_URL || 'http://localhost:5006';
    return {
      projectPath: root,
      dataPath: data,
      duckdbExists: existsSync(db),
      chatUrl,
      configured: existsSync(join(root, 'nao_config.yaml')),
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
      chatUrl: process.env.NAO_URL || 'http://localhost:5006',
    };
  }
}
