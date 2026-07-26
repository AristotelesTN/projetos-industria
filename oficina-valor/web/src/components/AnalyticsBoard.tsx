import { useMemo, useState } from 'react';
import { brl } from '../lib/api';

type Health = 'green' | 'yellow' | 'red';

function healthFromBrr(brr: number | null | undefined): Health {
  if (brr == null) return 'yellow';
  if (brr >= 0.7) return 'green';
  if (brr >= 0.4) return 'yellow';
  return 'red';
}

function Sparkline({
  values,
  color = '#0c66e4',
}: {
  values: number[];
  color?: string;
}) {
  const w = 88;
  const h = 36;
  if (!values.length) {
    return <svg width={w} height={h} />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values, min + 1);
  const pts = values
    .map((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * (w - 4) + 2;
      const y = h - 4 - ((v - min) / (max - min)) * (h - 8);
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts}
      />
    </svg>
  );
}

function Donut({
  segments,
  totalLabel,
  totalValue,
}: {
  segments: { label: string; value: number; color: string }[];
  totalLabel: string;
  totalValue: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  const stops = segments
    .map((seg) => {
      const start = (acc / total) * 100;
      acc += seg.value;
      const end = (acc / total) * 100;
      return `${seg.color} ${start}% ${end}%`;
    })
    .join(', ');

  return (
    <div className="status-overview">
      <div
        className="donut"
        style={{ background: `conic-gradient(${stops})` }}
      >
        <div className="donut-center">
          <strong>{totalValue}</strong>
          <span>{totalLabel}</span>
        </div>
      </div>
      <ul className="status-legend">
        {segments.map((s) => (
          <li key={s.label}>
            <span className="swatch" style={{ background: s.color }} />
            {s.label}
            <span className="count">{brl(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AnalyticsBoard({
  portfolio,
  onOpenWizard,
  onOpenInsights,
}: {
  portfolio: any | null;
  onOpenWizard: () => void;
  onOpenInsights: () => void;
}) {
  const [view, setView] = useState<'overview' | 'ganhos' | 'risco' | 'areas'>(
    'overview',
  );
  const [areaFilter, setAreaFilter] = useState('all');

  const projects = useMemo(() => {
    return (portfolio?.porProjeto || []).map((p: any) => ({
      ...p,
      health: p.health || healthFromBrr(p.brr),
      area: p.area || 'Área',
    }));
  }, [portfolio]);

  const areas = useMemo(() => {
    const set = new Set<string>();
    for (const p of projects) set.add(String(p.area || 'Área'));
    return Array.from(set).sort();
  }, [projects]);

  const filtered = useMemo(() => {
    if (areaFilter === 'all') return projects;
    return projects.filter((p: any) => p.area === areaFilter);
  }, [projects, areaFilter]);

  if (!portfolio) {
    return (
      <section className="panel">
        <p className="muted">Carregando analytics de valor…</p>
      </section>
    );
  }

  const prometido = Number(portfolio.prometido || 0);
  const realizado = Number(portfolio.realizado || 0);
  const custo = Number(portfolio.custo || 0);
  const hard = Number(portfolio.hard || 0);
  const soft = Number(portfolio.soft || 0);
  const capturePct = prometido > 0 ? (realizado / prometido) * 100 : 0;
  const roiPct =
    portfolio.roi == null ? null : Number(portfolio.roi) * 100;
  const brrAvg =
    filtered.length === 0
      ? 0
      : (filtered.reduce(
          (s: number, p: any) => s + (p.brr == null ? 0 : p.brr),
          0,
        ) /
          filtered.length) *
        100;

  const sparkRealizado = (portfolio.curvaS || []).map(
    (c: any) => Number(c.realizadoAcumulado) || 0,
  );
  const sparkPlanejado = (portfolio.curvaS || []).map(
    (c: any) => Number(c.planejadoAcumulado) || 0,
  );

  const healthCounts = {
    green: filtered.filter((p: any) => p.health === 'green').length,
    yellow: filtered.filter((p: any) => p.health === 'yellow').length,
    red: filtered.filter((p: any) => p.health === 'red').length,
  };

  const byArea = areas.map((area) => {
    const items = projects.filter((p: any) => p.area === area);
    const real = items.reduce((s: number, p: any) => s + Number(p.realizado || 0), 0);
    const prom = items.reduce((s: number, p: any) => s + Number(p.prometido || 0), 0);
    const risk = items.filter((p: any) => p.health !== 'green').length;
    return { area, real, prom, risk, count: items.length };
  });

  const attention = [...filtered]
    .sort((a: any, b: any) => Number(a.brr ?? 1) - Number(b.brr ?? 1))
    .slice(0, 6);

  const prescriptions = [
    healthCounts.red > 0 && {
      tone: 'danger',
      title: `${healthCounts.red} projeto(s) delayed (BRR < 40%)`,
      text: 'Priorize wizard de realização e revisão de baseline nos cards críticos.',
    },
    capturePct < 40 && {
      tone: 'warning',
      title: 'Captura de valor abaixo de 40% da baseline',
      text: 'Acelere medições na janela de savings e valide hard savings com Finanças.',
    },
    soft > hard * 0.5 && hard > 0 && {
      tone: 'info',
      title: 'Soft savings representativos no mix',
      text: 'Avalie reclassificação para hard quando houver redução real de headcount/HE.',
    },
    roiPct != null && roiPct < 20 && {
      tone: 'warning',
      title: 'ROI do portfólio pressionado',
      text: 'Compare custo realizado vs benefício validado nos programas de maior investimento.',
    },
    healthCounts.green === filtered.length &&
      filtered.length > 0 && {
        tone: 'success',
        title: 'Portfólio on track',
        text: 'Mantenha o ritmo de homologação e use Insights para antecipar desvios.',
      },
  ].filter(Boolean) as { tone: string; title: string; text: string }[];

  const roiBars = [...filtered]
    .filter((p: any) => p.roi != null)
    .sort((a: any, b: any) => Number(b.roi) - Number(a.roi))
    .slice(0, 6);
  const maxRoi = Math.max(0.01, ...roiBars.map((p: any) => Math.abs(Number(p.roi))));

  return (
    <div className="analytics">
      <div className="analytics-hero">
        <div>
          <h2>Analytics de valor</h2>
          <p className="muted">
            Rastreie ganhos, ROI, BRR e desvios do portfólio — visão executiva da Oficina.
          </p>
        </div>
        <div className="top-actions">
          <button className="btn secondary" onClick={onOpenInsights}>
            Insights
          </button>
          <button className="btn" onClick={onOpenWizard}>
            + Registrar ganho
          </button>
        </div>
      </div>

      <div className="analytics-tabs">
        {(
          [
            ['overview', 'Overview'],
            ['ganhos', 'Ganhos'],
            ['risco', 'Risco'],
            ['areas', 'Áreas'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={`analytics-tab ${view === id ? 'active' : ''}`}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <label className="field" style={{ margin: 0, minWidth: 160 }}>
          Área
          <select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
          >
            <option value="all">Todas</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <span className="badge in-progress">{filtered.length} projetos</span>
        <span className="badge warning">{portfolio.projetosEmRisco} em risco</span>
      </div>

      <div className={`insight-banner tone-${prescriptions[0]?.tone || 'info'}`}>
        <strong>{prescriptions[0]?.title || 'Sem alertas críticos'}</strong>
        <span>{prescriptions[0]?.text || 'Portfólio estável no período.'}</span>
      </div>

      <div className="kpi-row">
        <article className="kpi-card">
          <div className="kpi-top">
            <div>
              <div className="label">Ganhos realizados</div>
              <div className="value">{brl(realizado)}</div>
              <div className={`trend ${capturePct >= 30 ? 'up' : 'down'}`}>
                {capturePct.toFixed(0)}% da baseline
              </div>
            </div>
            <Sparkline values={sparkRealizado} color="#22a06b" />
          </div>
        </article>
        <article className="kpi-card">
          <div className="kpi-top">
            <div>
              <div className="label">ROI portfólio</div>
              <div className="value">{portfolio.roiLabel}</div>
              <div className={`trend ${(roiPct ?? 0) >= 0 ? 'up' : 'down'}`}>
                Custo {brl(custo)}
              </div>
            </div>
            <Sparkline values={sparkPlanejado} color="#0c66e4" />
          </div>
        </article>
        <article className="kpi-card">
          <div className="kpi-top">
            <div>
              <div className="label">BRR médio</div>
              <div className="value">{brrAvg.toFixed(0)}%</div>
              <div className={`trend ${brrAvg >= 70 ? 'up' : 'down'}`}>
                Meta 70% · {healthCounts.red} delayed
              </div>
            </div>
            <Sparkline
              values={filtered.map((p: any) => (p.brr ?? 0) * 100)}
              color="#e56910"
            />
          </div>
        </article>
      </div>

      {(view === 'overview' || view === 'ganhos') && (
        <div className="dash-grid">
          <section className="panel">
            <div className="panel-head">
              <h2>Ganhos por categoria</h2>
              <span className="meta">Hard · Soft · Avoidance</span>
            </div>
            <Donut
              totalLabel="TOTAL"
              totalValue={brl(hard + soft)}
              segments={[
                { label: 'Hard', value: hard, color: '#22a06b' },
                { label: 'Soft', value: soft, color: '#0c66e4' },
                {
                  label: 'Baseline restante',
                  value: Math.max(0, prometido - realizado),
                  color: '#dfe1e6',
                },
              ]}
            />
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>ROI por projeto</h2>
              <span className="meta">Top programas</span>
            </div>
            <div className="hbar-list">
              {roiBars.map((p: any) => {
                const pct = (Math.abs(Number(p.roi)) / maxRoi) * 100;
                const tone =
                  Number(p.roi) >= 0.5
                    ? 'green'
                    : Number(p.roi) >= 0.2
                      ? 'blue'
                      : 'orange';
                return (
                  <div className="hbar-row" key={p.projetoId}>
                    <div className="hbar-label">{p.nome}</div>
                    <div className="hbar-track">
                      <i className={tone} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="hbar-value">{p.roiLabel}</div>
                  </div>
                );
              })}
              {!roiBars.length && <p className="muted">Sem ROI calculável ainda.</p>}
            </div>
          </section>
        </div>
      )}

      {(view === 'overview' || view === 'risco') && (
        <div className="dash-grid">
          <section className="panel">
            <div className="panel-head">
              <h2>Captura vs baseline</h2>
              <strong className="progress-pct">{capturePct.toFixed(0)}% CAPTURADO</strong>
            </div>
            <div className="progress-track thick">
              <i className="done" style={{ width: `${Math.min(100, capturePct)}%` }} />
              <i
                className="todo"
                style={{ width: `${Math.max(0, 100 - capturePct)}%` }}
              />
            </div>
            <div className="progress-legend">
              <span className="done">Realizado {brl(realizado)}</span>
              <span className="todo">Prometido {brl(prometido)}</span>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Saúde do portfólio</h2>
              <strong className="progress-pct">
                {filtered.length
                  ? `${((healthCounts.green / filtered.length) * 100).toFixed(0)}% ON TRACK`
                  : '—'}
              </strong>
            </div>
            <div className="progress-track thick">
              <i
                className="done"
                style={{
                  width: `${(healthCounts.green / Math.max(1, filtered.length)) * 100}%`,
                }}
              />
              <i
                className="progress"
                style={{
                  width: `${(healthCounts.yellow / Math.max(1, filtered.length)) * 100}%`,
                  background: '#f5cd47',
                }}
              />
              <i
                className="todo"
                style={{
                  width: `${(healthCounts.red / Math.max(1, filtered.length)) * 100}%`,
                  background: '#e34935',
                }}
              />
            </div>
            <div className="progress-legend">
              <span className="done">{healthCounts.green} on track</span>
              <span className="progress">{healthCounts.yellow} at risk</span>
              <span className="todo" style={{ color: '#ae2e24' }}>
                {healthCounts.red} delayed
              </span>
            </div>
          </section>
        </div>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2>Curva S · planejado vs realizado</h2>
          <span className="meta">Acumulado mensal</span>
        </div>
        <CurvaSCompact data={portfolio.curvaS || []} />
      </section>

      {(view === 'overview' || view === 'areas' || view === 'risco') && (
        <section className="panel">
          <div className="panel-head">
            <h2>Programas que precisam de atenção</h2>
            <span className="meta">Prescrições por BRR / ROI</span>
          </div>
          <div className="attention-grid">
            {attention.slice(0, 3).map((p: any, idx: number) => {
              const brrPct = p.brr == null ? 0 : p.brr * 100;
              return (
                <article className="attention-card" key={p.projetoId}>
                  <div className="attention-head">
                    <span className="muted">{idx + 1}. {p.area || 'Área'}</span>
                    <span className={`badge ${p.health === 'green' ? 'done' : p.health === 'yellow' ? 'warning' : 'danger'}`}>
                      {p.health === 'green' ? 'On track' : p.health === 'yellow' ? 'At risk' : 'Delayed'}
                    </span>
                  </div>
                  <h3>{p.nome}</h3>
                  <div className="attention-metric">
                    {(p.brr == null ? 0 : p.brr * 100).toFixed(0)}% BRR
                  </div>
                  <div className="progress-track">
                    <i
                      className={p.health === 'green' ? 'done' : 'progress'}
                      style={{
                        width: `${Math.min(100, brrPct)}%`,
                        background:
                          p.health === 'green'
                            ? '#22a06b'
                            : p.health === 'yellow'
                              ? '#f5cd47'
                              : '#e34935',
                      }}
                    />
                  </div>
                  <div className="attention-foot">
                    <span>{brl(p.realizado)} real.</span>
                    <span>{p.roiLabel}</span>
                    <span>{brl(p.prometido)} base</span>
                  </div>
                </article>
              );
            })}
          </div>

          {byArea.length > 0 && view !== 'risco' && (
            <>
              <h3 style={{ marginTop: 24 }}>Por área</h3>
              <div className="attention-grid">
                {byArea.map((a) => (
                  <article className="attention-card" key={a.area}>
                    <div className="attention-head">
                      <span className="muted">{a.count} programas</span>
                      <span className="badge warning">{a.risk} risco</span>
                    </div>
                    <h3>{a.area}</h3>
                    <div className="attention-metric">{brl(a.real)}</div>
                    <div className="progress-track">
                      <i
                        className="done"
                        style={{
                          width: `${a.prom ? Math.min(100, (a.real / a.prom) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <div className="attention-foot">
                      <span>Base {brl(a.prom)}</span>
                      <span>
                        {a.prom ? ((a.real / a.prom) * 100).toFixed(0) : 0}% capt.
                      </span>
                      <span>{a.risk} atenção</span>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2>Prescrições da Oficina</h2>
          <span className="meta">Ações recomendadas</span>
        </div>
        <div className="prescription-list">
          {prescriptions.map((p) => (
            <div key={p.title} className={`prescription tone-${p.tone}`}>
              <strong>{p.title}</strong>
              <span>{p.text}</span>
            </div>
          ))}
          {!prescriptions.length && (
            <p className="muted">Nenhuma prescrição no momento.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function CurvaSCompact({
  data,
}: {
  data: {
    periodo: string;
    planejadoAcumulado: number;
    realizadoAcumulado: number;
  }[];
}) {
  const max = Math.max(
    1,
    ...data.map((d) => Math.max(d.planejadoAcumulado, d.realizadoAcumulado)),
  );
  if (!data.length) return <p className="muted">Sem série ainda.</p>;
  return (
    <div className="chart">
      {data.map((d) => (
        <div className="bar-row" key={d.periodo}>
          <span>{d.periodo}</span>
          <div className="bar" title={`Planejado ${brl(d.planejadoAcumulado)}`}>
            <i style={{ width: `${(d.planejadoAcumulado / max) * 100}%` }} />
          </div>
          <div
            className="bar actual"
            title={`Realizado ${brl(d.realizadoAcumulado)}`}
          >
            <i style={{ width: `${(d.realizadoAcumulado / max) * 100}%` }} />
          </div>
        </div>
      ))}
      <p className="muted">Azul: planejado · Verde: realizado</p>
    </div>
  );
}
