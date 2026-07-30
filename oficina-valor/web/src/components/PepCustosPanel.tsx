import { useEffect, useMemo, useState, Fragment } from 'react';
import { api, brl } from '../lib/api';

type PepCustosData = {
  totais: {
    orcamento: number;
    compromissadoTotal: number;
    realizado: number;
    comprometido: number;
    disponivel: number;
    peps: number;
  };
  porAno: Array<{
    ano: number;
    orcamento: number;
    compromissadoTotal: number;
    realizado: number;
    comprometido: number;
    disponivel: number;
    peps: number;
  }>;
  porProjeto: Array<{
    projetoId: string;
    nome: string;
    area: string;
    status: string;
    escopoNegocio?: string;
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
  }>;
  topRealizado: Array<{ projetoId: string; nome: string; valor: number }>;
  topOrcamento: Array<{ projetoId: string; nome: string; valor: number }>;
  consumo: Array<{
    projetoId: string;
    nome: string;
    pct: number;
    orcamento: number;
    realizado: number;
  }>;
  anos: number[];
};

function GroupedYearBars({
  rows,
}: {
  rows: Array<{
    ano: number;
    orcamento: number;
    compromissadoTotal: number;
    realizado: number;
  }>;
}) {
  const max = Math.max(
    1,
    ...rows.flatMap((r) => [r.orcamento, r.compromissadoTotal, r.realizado]),
  );
  return (
    <div className="pep-year-chart">
      {rows.map((r) => (
        <div key={r.ano} className="pep-year-col">
          <div className="pep-year-bars">
            <i
              className="orc"
              style={{ height: `${(r.orcamento / max) * 100}%` }}
              title={`Orçado ${brl(r.orcamento)}`}
            />
            <i
              className="comp"
              style={{ height: `${(r.compromissadoTotal / max) * 100}%` }}
              title={`Compromissado ${brl(r.compromissadoTotal)}`}
            />
            <i
              className="real"
              style={{ height: `${(r.realizado / max) * 100}%` }}
              title={`Realizado ${brl(r.realizado)}`}
            />
          </div>
          <span>{r.ano}</span>
        </div>
      ))}
      {!rows.length && <p className="muted">Sem dados PEP</p>}
    </div>
  );
}

export function PepCustosPanel({
  onOpenProjeto,
  anoFilter = 'all',
  escopoFilter = 'all',
  areaFilter = 'all',
}: {
  onOpenProjeto?: (id: string) => void;
  anoFilter?: 'all' | number;
  escopoFilter?: 'all' | 'comercial' | 'industrial';
  areaFilter?: string;
}) {
  const [data, setData] = useState<PepCustosData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .pepCustos()
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError('');
        }
      })
      .catch((e: any) => {
        if (!cancelled) setError(e.message || String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredProjetos = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.porProjeto
      .map((p) => {
        if (
          escopoFilter !== 'all' &&
          (p.escopoNegocio || 'industrial') !== escopoFilter
        ) {
          return null;
        }
        if (areaFilter !== 'all' && p.area !== areaFilter) return null;
        const peps =
          anoFilter === 'all'
            ? p.peps
            : p.peps.filter((x) => x.ano === anoFilter);
        if (!peps.length && anoFilter !== 'all') return null;
        const orcamento = peps.reduce((s, x) => s + x.orcamento, 0);
        const compromissadoTotal = peps.reduce(
          (s, x) => s + x.compromissadoTotal,
          0,
        );
        const realizado = peps.reduce((s, x) => s + x.realizado, 0);
        const comprometido = peps.reduce((s, x) => s + x.comprometido, 0);
        const disponivel = peps.reduce((s, x) => s + x.disponivel, 0);
        if (
          q &&
          !p.nome.toLowerCase().includes(q) &&
          !p.area.toLowerCase().includes(q) &&
          !peps.some(
            (x) =>
              x.codigoPep.toLowerCase().includes(q) ||
              (x.descricao || '').toLowerCase().includes(q),
          )
        ) {
          return null;
        }
        return {
          ...p,
          peps,
          orcamento,
          compromissadoTotal,
          realizado,
          comprometido,
          disponivel,
        };
      })
      .filter(Boolean) as PepCustosData['porProjeto'];
  }, [data, anoFilter, escopoFilter, areaFilter, query]);

  const totaisFiltro = useMemo(() => {
    return filteredProjetos.reduce(
      (acc, p) => {
        acc.orcamento += p.orcamento;
        acc.compromissadoTotal += p.compromissadoTotal;
        acc.realizado += p.realizado;
        acc.comprometido += p.comprometido;
        acc.disponivel += p.disponivel;
        acc.peps += p.peps.length;
        return acc;
      },
      {
        orcamento: 0,
        compromissadoTotal: 0,
        realizado: 0,
        comprometido: 0,
        disponivel: 0,
        peps: 0,
      },
    );
  }, [filteredProjetos]);

  const porAnoChart = useMemo(() => {
    if (!data) return [];
    // Recalcula por ano a partir dos projetos já filtrados por escopo/área
    const map = new Map<
      number,
      {
        ano: number;
        orcamento: number;
        compromissadoTotal: number;
        realizado: number;
      }
    >();
    for (const p of filteredProjetos) {
      for (const pep of p.peps) {
        if (pep.ano == null) continue;
        if (anoFilter !== 'all' && pep.ano !== anoFilter) continue;
        const cur = map.get(pep.ano) || {
          ano: pep.ano,
          orcamento: 0,
          compromissadoTotal: 0,
          realizado: 0,
        };
        cur.orcamento += pep.orcamento;
        cur.compromissadoTotal += pep.compromissadoTotal;
        cur.realizado += pep.realizado;
        map.set(pep.ano, cur);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.ano - b.ano);
  }, [data, filteredProjetos, anoFilter]);

  if (loading) return <p className="muted">Carregando custos PEP…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Sem dados PEP.</p>;

  const captura =
    totaisFiltro.orcamento > 0
      ? (totaisFiltro.realizado / totaisFiltro.orcamento) * 100
      : 0;

  return (
    <div className="pep-analytics">
      <div className="toolbar">
        <label className="field" style={{ margin: 0, minWidth: 220 }}>
          Buscar
          <input
            type="search"
            placeholder="Projeto, área ou PEP…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <span className="badge in-progress">
          {filteredProjetos.length} projetos · {totaisFiltro.peps} PEPs
        </span>
      </div>

      <p className="muted" style={{ marginTop: 0 }}>
        Dados anuais do SAP (carteira PEP). Não há série mensal na origem —
        os totais abaixo refletem o acumulado do ano selecionado.
      </p>

      <div className="kpi-row">
        <article className="kpi-card">
          <div className="label">Orçado</div>
          <div className="value">{brl(totaisFiltro.orcamento)}</div>
        </article>
        <article className="kpi-card">
          <div className="label">Compromissado total</div>
          <div className="value">{brl(totaisFiltro.compromissadoTotal)}</div>
        </article>
        <article className="kpi-card">
          <div className="label">Realizado</div>
          <div className="value">{brl(totaisFiltro.realizado)}</div>
          <div className={`trend ${captura >= 50 ? 'up' : 'down'}`}>
            {captura.toFixed(0)}% do orçado
          </div>
        </article>
        <article className="kpi-card">
          <div className="label">Disponível</div>
          <div className="value">{brl(totaisFiltro.disponivel)}</div>
        </article>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Orçado × Compromissado × Realizado por ano</h2>
          <div className="pep-legend">
            <span>
              <i className="orc" /> Orçado
            </span>
            <span>
              <i className="comp" /> Compromissado
            </span>
            <span>
              <i className="real" /> Realizado
            </span>
          </div>
        </div>
        <GroupedYearBars rows={porAnoChart} />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Projetos e PEPs</h2>
          <span className="meta">Clique no nome para abrir o detalhe</span>
        </div>
        <div className="rag-table-wrap">
          <table className="rag-table pep-analytics-table">
            <thead>
              <tr>
                <th>Projeto</th>
                <th>Área</th>
                <th>PEPs</th>
                <th className="num">Orçado</th>
                <th className="num">Compromissado</th>
                <th className="num">Realizado</th>
                <th className="num">Disponível</th>
                <th className="num">% cons.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredProjetos.map((p) => {
                const aberto = expandido === p.projetoId;
                const pct =
                  p.orcamento > 0 ? (p.realizado / p.orcamento) * 100 : 0;
                return (
                  <Fragment key={p.projetoId}>
                    <tr>
                      <td>
                        {onOpenProjeto ? (
                          <button
                            type="button"
                            className="linkish"
                            onClick={() => onOpenProjeto(p.projetoId)}
                          >
                            {p.nome}
                          </button>
                        ) : (
                          <strong>{p.nome}</strong>
                        )}
                      </td>
                      <td>{p.area}</td>
                      <td>{p.peps.length}</td>
                      <td className="num">{brl(p.orcamento)}</td>
                      <td className="num">{brl(p.compromissadoTotal)}</td>
                      <td className="num">{brl(p.realizado)}</td>
                      <td className="num">{brl(p.disponivel)}</td>
                      <td className="num">{pct.toFixed(0)}%</td>
                      <td>
                        <button
                          type="button"
                          className="linkish"
                          onClick={() =>
                            setExpandido(aberto ? null : p.projetoId)
                          }
                        >
                          {aberto ? 'Ocultar PEPs' : 'Ver PEPs'}
                        </button>
                      </td>
                    </tr>
                    {aberto
                      ? p.peps.map((pep) => (
                          <tr key={pep.codigoPep} className="pep-subrow">
                            <td colSpan={2}>
                              <span className="muted">{pep.codigoPep}</span>
                              {pep.descricao ? ` · ${pep.descricao}` : ''}
                            </td>
                            <td>{pep.ano ?? '—'}</td>
                            <td className="num">{brl(pep.orcamento)}</td>
                            <td className="num">
                              {brl(pep.compromissadoTotal)}
                            </td>
                            <td className="num">{brl(pep.realizado)}</td>
                            <td className="num">{brl(pep.disponivel)}</td>
                            <td className="num">
                              {pep.orcamento > 0
                                ? `${((pep.realizado / pep.orcamento) * 100).toFixed(0)}%`
                                : '—'}
                            </td>
                            <td />
                          </tr>
                        ))
                      : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
