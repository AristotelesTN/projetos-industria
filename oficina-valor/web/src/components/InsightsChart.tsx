import { brl } from '../lib/api';

export type ChartSpec =
  | {
      type: 'bar';
      title: string;
      series: { label: string; value: number }[];
    }
  | {
      type: 'line';
      title: string;
      series: { label: string; planejado: number; realizado: number }[];
    }
  | {
      type: 'pie';
      title: string;
      series: { label: string; value: number }[];
    }
  | {
      type: 'kpi';
      title: string;
      items: { label: string; value: number; format?: 'brl' | 'number' }[];
    };

const PIE_COLORS = ['#5e6ad2', '#27a644', '#c47d0e', '#d93b3b', '#7a7fad'];

function fmtItem(value: number, format?: 'brl' | 'number') {
  if (format === 'brl') return brl(value);
  return new Intl.NumberFormat('pt-BR').format(value);
}

export function InsightsChart({ chart }: { chart: ChartSpec }) {
  if (chart.type === 'kpi') {
    return (
      <div className="insights-chart">
        <div className="insights-chart-title">{chart.title}</div>
        <div className="insights-kpi-grid">
          {chart.items.map((it) => (
            <div key={it.label} className="insights-kpi">
              <span>{it.label}</span>
              <strong>{fmtItem(it.value, it.format)}</strong>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (chart.type === 'bar') {
    const max = Math.max(1, ...chart.series.map((s) => s.value));
    return (
      <div className="insights-chart">
        <div className="insights-chart-title">{chart.title}</div>
        <div className="hbar-list">
          {chart.series.map((s) => (
            <div className="hbar-row" key={s.label}>
              <div className="hbar-label" title={s.label}>
                {s.label}
              </div>
              <div className="hbar-track">
                <i
                  className="blue"
                  style={{ width: `${(s.value / max) * 100}%` }}
                />
              </div>
              <div className="hbar-value">
                {Number.isInteger(s.value)
                  ? s.value
                  : s.value.toFixed(2)}
              </div>
            </div>
          ))}
          {!chart.series.length && <p className="muted">Sem dados</p>}
        </div>
      </div>
    );
  }

  if (chart.type === 'line') {
    const max = Math.max(
      1,
      ...chart.series.flatMap((s) => [s.planejado, s.realizado]),
    );
    return (
      <div className="insights-chart">
        <div className="insights-chart-title">{chart.title}</div>
        <div className="chart">
          {chart.series.map((d) => (
            <div className="bar-row" key={d.label}>
              <span>{d.label}</span>
              <div className="bar" title={`Planejado ${brl(d.planejado)}`}>
                <i style={{ width: `${(d.planejado / max) * 100}%` }} />
              </div>
              <div
                className="bar actual"
                title={`Realizado ${brl(d.realizado)}`}
              >
                <i style={{ width: `${(d.realizado / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="insights-legend">
          <span>
            <i className="leg planejado" /> Planejado
          </span>
          <span>
            <i className="leg realizado" /> Realizado
          </span>
        </div>
      </div>
    );
  }

  if (chart.type === 'pie') {
    const total = chart.series.reduce((s, x) => s + x.value, 0) || 1;
    let acc = 0;
    const stops = chart.series.map((s, i) => {
      const start = (acc / total) * 360;
      acc += s.value;
      const end = (acc / total) * 360;
      return `${PIE_COLORS[i % PIE_COLORS.length]} ${start}deg ${end}deg`;
    });

    return (
      <div className="insights-chart">
        <div className="insights-chart-title">{chart.title}</div>
        <div className="insights-pie-wrap">
          <div
            className="insights-pie"
            style={{
              background: stops.length
                ? `conic-gradient(${stops.join(', ')})`
                : 'var(--ds-border)',
            }}
          />
          <ul className="insights-pie-legend">
            {chart.series.map((s, i) => (
              <li key={s.label}>
                <i style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span>{s.label}</span>
                <strong>{brl(s.value)}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="insights-chart">
      <div className="insights-chart-title">
        {(chart as { title?: string }).title || 'Gráfico'}
      </div>
      <p className="muted">Tipo de gráfico não suportado neste painel.</p>
    </div>
  );
}
