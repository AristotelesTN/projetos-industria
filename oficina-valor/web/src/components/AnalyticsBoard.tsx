import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { brl } from '../lib/api';
import { PepCustosPanel } from './PepCustosPanel';

type Health = 'green' | 'yellow' | 'red';

function healthFromBrr(brr: number | null | undefined): Health {
  if (brr == null) return 'yellow';
  if (brr >= 0.7) return 'green';
  if (brr >= 0.4) return 'yellow';
  return 'red';
}

function fmtOrDash(
  value: unknown,
  format: (n: number) => string,
): string {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n) || n === 0) return '—';
  return format(n);
}

type PotencialKpiId =
  | 'quantitativos'
  | 'ganho_estimado'
  | 'risco'
  | 'negocio'
  | 'horas'
  | 'recorrentes'
  | 'pontuais'
  | 'horizonte3'
  | 'qualitativos'
  | 'capex'
  | 'opex'
  | 'capex_opex_pend'
  | 'capex_opex_aplic';

type RacionalRow = {
  projetoId: string;
  nome: string;
  area: string;
  status?: string;
  valor: number;
  detalhe?: string;
  racional?: string | null;
};

type RacionalView = {
  id: PotencialKpiId;
  title: string;
  formula: string;
  total: number;
  unit: 'brl' | 'hours' | 'count';
  rows: RacionalRow[];
};

function nVal(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function buildCurvaSFromProjects(
  projects: any[],
  anoFilter: 'all' | number,
): {
  periodo: string;
  planejadoAcumulado: number;
  realizadoAcumulado: number;
}[] {
  const mapPlan = new Map<string, number>();
  const mapAct = new Map<string, number>();
  for (const p of projects) {
    let prevP = 0;
    let prevA = 0;
    for (const pt of p.curvaS || []) {
      const year = Number(String(pt.periodo).slice(0, 4));
      const dP = Number(pt.planejadoAcumulado) - prevP;
      const dA = Number(pt.realizadoAcumulado) - prevA;
      prevP = Number(pt.planejadoAcumulado);
      prevA = Number(pt.realizadoAcumulado);
      if (anoFilter !== 'all' && year !== anoFilter) continue;
      mapPlan.set(pt.periodo, (mapPlan.get(pt.periodo) ?? 0) + dP);
      mapAct.set(pt.periodo, (mapAct.get(pt.periodo) ?? 0) + dA);
    }
  }
  const months = Array.from(
    new Set([...mapPlan.keys(), ...mapAct.keys()]),
  ).sort();
  let accP = 0;
  let accA = 0;
  return months.map((m) => {
    accP += mapPlan.get(m) ?? 0;
    accA += mapAct.get(m) ?? 0;
    return {
      periodo: m,
      planejadoAcumulado: accP,
      realizadoAcumulado: accA,
    };
  });
}

function computePotencialFromProjects(projects: any[]) {
  let potencialFinanceiro = 0;
  let potencialRisco = 0;
  let potencialNegocio = 0;
  let potencialHoras = 0;
  let potencialRecorrenteAnual = 0;
  let potencialPontual = 0;
  let qtdeRecorrentes = 0;
  let qtdePontuais = 0;
  let qtdeQuantitativos = 0;
  let qtdeQualitativos = 0;
  let excluidos = 0;
  let capex = 0;
  let opex = 0;
  let capexParaOpex = 0;
  let capexParaOpexPendente = 0;
  let capexParaOpexAplicado = 0;

  for (const p of projects) {
    if (p.excluirDoPotencialEstimado) {
      excluidos += 1;
      continue;
    }
    const fin = nVal(p.ganhoFinanceiroAnual);
    const risco = nVal(p.riscoFinanceiroMitigadoAnual);
    const negocio = nVal(p.ganhoNegocioAnual);
    const horas = nVal(p.horasEconomizadasAno);
    potencialFinanceiro += fin;
    potencialRisco += risco;
    potencialNegocio += negocio;
    potencialHoras += horas;
    const monetario = fin + risco + negocio;
    const temGanho =
      monetario > 0 || horas > 0 || p.ganhoPrincipal != null;
    if (temGanho) {
      if (p.ganhoRecorrente) {
        qtdeRecorrentes += 1;
        potencialRecorrenteAnual += monetario;
      } else {
        qtdePontuais += 1;
        potencialPontual += monetario;
      }
    }
    capex += nVal(p.investimentoCapex);
    opex += nVal(p.investimentoOpex);
    const planejadoCapexOpex = nVal(p.investimentoCapexParaOpex);
    capexParaOpex += planejadoCapexOpex;
    if (p.capexParaOpexAplicadoEm) capexParaOpexAplicado += planejadoCapexOpex;
    else capexParaOpexPendente += planejadoCapexOpex;

    if (p.ganhoPrincipal === 'qualitativo') qtdeQualitativos += 1;
    else if (p.ganhoPrincipal) qtdeQuantitativos += 1;
  }

  const totalClassificados = qtdeQuantitativos + qtdeQualitativos;
  return {
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
      recorrente: {
        projetos: qtdeRecorrentes,
        anual: potencialRecorrenteAnual,
        horizonte3Anos: potencialRecorrenteAnual * 3,
      },
      pontual: { projetos: qtdePontuais, total: potencialPontual },
      horizonte3Anos: potencialRecorrenteAnual * 3 + potencialPontual,
      excluidos,
    },
    investimento: {
      capex,
      opex,
      capexParaOpex,
      capexParaOpexPendente,
      capexParaOpexAplicado,
    },
  };
}

function monetarioProjeto(p: any): number {
  return (
    nVal(p.ganhoFinanceiroAnual) +
    nVal(p.riscoFinanceiroMitigadoAnual) +
    nVal(p.ganhoNegocioAnual)
  );
}

function buildRacional(
  id: PotencialKpiId,
  projects: any[],
): RacionalView {
  const statusLabel: Record<string, string> = {
    conceito: 'A iniciar',
    aprovado: 'Aprovado',
    execucao: 'Em andamento',
    hold: 'Suspenso',
    sustentacao: 'Sustentação',
    encerrado: 'Concluído',
    morto: 'Arquivado',
  };
  const fmtStatus = (s?: string) =>
    (s && statusLabel[s]) || s || '—';

  // Suspensos/cancelados (ou marcados) não entram no racional estimado.
  projects = projects.filter((p) => !p.excluirDoPotencialEstimado);

  const base = (title: string, formula: string, unit: RacionalView['unit']) => ({
    id,
    title,
    formula,
    unit,
  });

  if (id === 'quantitativos') {
    const rows = projects
      .filter((p) => p.ganhoPrincipal && p.ganhoPrincipal !== 'qualitativo')
      .map((p) => ({
        projetoId: p.projetoId,
        nome: p.nome,
        area: p.area,
        status: fmtStatus(p.status),
        valor: 1,
        detalhe: String(p.ganhoPrincipal),
        racional: p.memoriaCalculoGanho,
      }));
    return {
      ...base(
        'Projetos quantitativos',
        'Contagem de projetos com ganho principal quantitativo (financeiro, risco, negócio ou horas) — exclui qualitativos.',
        'count',
      ),
      total: rows.length,
      rows,
    };
  }

  if (id === 'qualitativos') {
    const rows = projects
      .filter((p) => p.ganhoPrincipal === 'qualitativo')
      .map((p) => ({
        projetoId: p.projetoId,
        nome: p.nome,
        area: p.area,
        status: fmtStatus(p.status),
        valor: 1,
        detalhe: p.categoriaQualitativa || 'qualitativo',
        racional: p.memoriaCalculoGanho,
      }));
    return {
      ...base(
        'Projetos qualitativos',
        'Contagem de projetos cujo ganho principal é qualitativo (ex.: estruturante).',
        'count',
      ),
      total: rows.length,
      rows,
    };
  }

  if (id === 'ganho_estimado') {
    const rows = projects
      .filter((p) => nVal(p.ganhoFinanceiroAnual) > 0)
      .map((p) => ({
        projetoId: p.projetoId,
        nome: p.nome,
        area: p.area,
        status: fmtStatus(p.status),
        valor: nVal(p.ganhoFinanceiroAnual),
        detalhe: p.economiaEstimadaAno
          ? `Est. planilha ${brl(nVal(p.economiaEstimadaAno))}`
          : undefined,
        racional: p.memoriaCalculoGanho,
      }))
      .sort((a, b) => b.valor - a.valor);
    return {
      ...base(
        'Ganho estimado',
        'Soma da economia estimada anual informada em cada projeto (ficha / planilha).',
        'brl',
      ),
      total: rows.reduce((s, r) => s + r.valor, 0),
      rows,
    };
  }

  if (id === 'risco') {
    const rows = projects
      .filter((p) => nVal(p.riscoFinanceiroMitigadoAnual) > 0)
      .map((p) => ({
        projetoId: p.projetoId,
        nome: p.nome,
        area: p.area,
        status: fmtStatus(p.status),
        valor: nVal(p.riscoFinanceiroMitigadoAnual),
        racional: p.memoriaCalculoGanho,
      }))
      .sort((a, b) => b.valor - a.valor);
    return {
      ...base(
        'Risco financeiro mitigado',
        'Soma do risco financeiro mitigado por ano declarado em cada projeto.',
        'brl',
      ),
      total: rows.reduce((s, r) => s + r.valor, 0),
      rows,
    };
  }

  if (id === 'negocio') {
    const rows = projects
      .filter((p) => nVal(p.ganhoNegocioAnual) > 0)
      .map((p) => ({
        projetoId: p.projetoId,
        nome: p.nome,
        area: p.area,
        status: fmtStatus(p.status),
        valor: nVal(p.ganhoNegocioAnual),
        racional: p.memoriaCalculoGanho,
      }))
      .sort((a, b) => b.valor - a.valor);
    return {
      ...base(
        'Ganho do negócio',
        'Soma dos ganhos de negócio anuais declarados em cada projeto.',
        'brl',
      ),
      total: rows.reduce((s, r) => s + r.valor, 0),
      rows,
    };
  }

  if (id === 'horas') {
    const rows = projects
      .filter((p) => nVal(p.horasEconomizadasAno) > 0)
      .map((p) => ({
        projetoId: p.projetoId,
        nome: p.nome,
        area: p.area,
        status: fmtStatus(p.status),
        valor: nVal(p.horasEconomizadasAno),
        racional: p.memoriaCalculoGanho,
      }))
      .sort((a, b) => b.valor - a.valor);
    return {
      ...base(
        'Horas economizadas',
        'Soma das horas economizadas por ano (retorno HH ou HH engenheiro + líder + analista).',
        'hours',
      ),
      total: rows.reduce((s, r) => s + r.valor, 0),
      rows,
    };
  }

  if (id === 'recorrentes') {
    const rows = projects
      .filter((p) => {
        const m = monetarioProjeto(p);
        return (
          p.ganhoRecorrente &&
          (m > 0 || nVal(p.horasEconomizadasAno) > 0 || p.ganhoPrincipal)
        );
      })
      .map((p) => ({
        projetoId: p.projetoId,
        nome: p.nome,
        area: p.area,
        status: fmtStatus(p.status),
        valor: monetarioProjeto(p),
        detalhe: 'Recorrente',
        racional: p.memoriaCalculoGanho,
      }))
      .sort((a, b) => b.valor - a.valor);
    const anual = rows.reduce((s, r) => s + r.valor, 0);
    return {
      ...base(
        'Recorrentes (anual)',
        'Soma monetária dos projetos com ganho recorrente (financeiro + risco + negócio). Em 3 anos = anual × 3.',
        'brl',
      ),
      total: anual,
      rows,
    };
  }

  if (id === 'pontuais') {
    const rows = projects
      .filter((p) => {
        const m = monetarioProjeto(p);
        return (
          !p.ganhoRecorrente &&
          (m > 0 || nVal(p.horasEconomizadasAno) > 0 || p.ganhoPrincipal)
        );
      })
      .map((p) => ({
        projetoId: p.projetoId,
        nome: p.nome,
        area: p.area,
        status: fmtStatus(p.status),
        valor: monetarioProjeto(p),
        detalhe: 'Pontual',
        racional: p.memoriaCalculoGanho,
      }))
      .sort((a, b) => b.valor - a.valor);
    return {
      ...base(
        'Pontuais (uma vez)',
        'Soma monetária dos projetos com ganho pontual. Entra uma única vez no horizonte.',
        'brl',
      ),
      total: rows.reduce((s, r) => s + r.valor, 0),
      rows,
    };
  }

  if (id === 'horizonte3') {
    const rec = projects.filter((p) => p.ganhoRecorrente);
    const pont = projects.filter((p) => !p.ganhoRecorrente);
    const rows: RacionalRow[] = [
      ...rec
        .map((p) => ({
          projetoId: p.projetoId,
          nome: p.nome,
          area: p.area,
          status: fmtStatus(p.status),
          valor: monetarioProjeto(p) * 3,
          detalhe: `Recorrente ${brl(monetarioProjeto(p))} × 3`,
          racional: p.memoriaCalculoGanho,
        }))
        .filter((r) => r.valor > 0),
      ...pont
        .map((p) => ({
          projetoId: p.projetoId,
          nome: p.nome,
          area: p.area,
          status: fmtStatus(p.status),
          valor: monetarioProjeto(p),
          detalhe: 'Pontual × 1',
          racional: p.memoriaCalculoGanho,
        }))
        .filter((r) => r.valor > 0),
    ].sort((a, b) => b.valor - a.valor);
    return {
      ...base(
        'Horizonte 3 anos',
        'Recorrentes × 3 anos + pontuais × 1.',
        'brl',
      ),
      total: rows.reduce((s, r) => s + r.valor, 0),
      rows,
    };
  }

  if (id === 'capex') {
    const rows = projects
      .filter((p) => nVal(p.investimentoCapex) > 0)
      .map((p) => ({
        projetoId: p.projetoId,
        nome: p.nome,
        area: p.area,
        status: fmtStatus(p.status),
        valor: nVal(p.investimentoCapex),
        racional: p.memoriaCalculoGanho,
      }))
      .sort((a, b) => b.valor - a.valor);
    return {
      ...base(
        'Investimento CAPEX',
        'Soma do CAPEX informado (ou investimento aprovado) por projeto.',
        'brl',
      ),
      total: rows.reduce((s, r) => s + r.valor, 0),
      rows,
    };
  }

  if (id === 'opex') {
    const rows = projects
      .filter((p) => nVal(p.investimentoOpex) > 0)
      .map((p) => ({
        projetoId: p.projetoId,
        nome: p.nome,
        area: p.area,
        status: fmtStatus(p.status),
        valor: nVal(p.investimentoOpex),
        racional: p.memoriaCalculoGanho,
      }))
      .sort((a, b) => b.valor - a.valor);
    return {
      ...base(
        'Investimento OPEX',
        'Soma do OPEX informado por projeto.',
        'brl',
      ),
      total: rows.reduce((s, r) => s + r.valor, 0),
      rows,
    };
  }

  if (id === 'capex_opex_pend') {
    const rows = projects
      .filter(
        (p) =>
          nVal(p.investimentoCapexParaOpex) > 0 && !p.capexParaOpexAplicadoEm,
      )
      .map((p) => ({
        projetoId: p.projetoId,
        nome: p.nome,
        area: p.area,
        status: fmtStatus(p.status),
        valor: nVal(p.investimentoCapexParaOpex),
        detalhe: 'Pendente',
        racional: p.memoriaCalculoGanho,
      }))
      .sort((a, b) => b.valor - a.valor);
    return {
      ...base(
        'CAPEX → OPEX pendente',
        'Valores planejados para migrar de CAPEX para OPEX após Encerrar ou Sustentação.',
        'brl',
      ),
      total: rows.reduce((s, r) => s + r.valor, 0),
      rows,
    };
  }

  // capex_opex_aplic
  const rows = projects
    .filter(
      (p) =>
        nVal(p.investimentoCapexParaOpex) > 0 && p.capexParaOpexAplicadoEm,
    )
    .map((p) => ({
      projetoId: p.projetoId,
      nome: p.nome,
      area: p.area,
      status: fmtStatus(p.status),
      valor: nVal(p.investimentoCapexParaOpex),
      detalhe: p.capexParaOpexAplicadoEm
        ? `Aplicado em ${new Date(p.capexParaOpexAplicadoEm).toLocaleDateString('pt-BR')}`
        : 'Aplicado',
      racional: p.memoriaCalculoGanho,
    }))
    .sort((a, b) => b.valor - a.valor);
  return {
    ...base(
      'CAPEX → OPEX aplicado',
      'Valores já migrados de CAPEX para OPEX após implementação do projeto.',
      'brl',
    ),
    total: rows.reduce((s, r) => s + r.valor, 0),
    rows,
  };
}

function formatRacionalValor(
  unit: RacionalView['unit'],
  valor: number,
): string {
  if (unit === 'brl') return brl(valor);
  if (unit === 'hours') {
    return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(valor)} h`;
  }
  return new Intl.NumberFormat('pt-BR').format(valor);
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
  const centerRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLElement>(null);
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

  useLayoutEffect(() => {
    const box = centerRef.current;
    const el = valueRef.current;
    if (!box || !el) return;

    const fit = () => {
      const maxW = Math.max(0, box.clientWidth - 4);
      const maxH = Math.max(0, box.clientHeight * 0.62);
      let lo = 8;
      let hi = 22;
      let best = lo;
      el.style.fontSize = `${hi}px`;
      // Binary search font size that fits width and height
      let steps = 0;
      while (lo <= hi && steps++ < 64) {
        const mid = Math.round(((lo + hi) / 2) * 4) / 4;
        el.style.fontSize = `${mid}px`;
        const fits =
          el.scrollWidth <= maxW + 0.5 && el.scrollHeight <= maxH + 0.5;
        if (fits) {
          best = mid;
          lo = mid + 0.25;
        } else {
          hi = mid - 0.25;
        }
      }
      el.style.fontSize = `${best}px`;
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    if (box.parentElement) ro.observe(box.parentElement);
    return () => ro.disconnect();
  }, [totalValue]);

  return (
    <div className="status-overview">
      <div
        className="donut"
        style={{ background: `conic-gradient(${stops})` }}
      >
        <div className="donut-center" ref={centerRef}>
          <strong ref={valueRef}>{totalValue}</strong>
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
  onOpenInsights,
  onOpenAgents,
  onOpenProjeto,
  agentsPending = 0,
}: {
  portfolio: any | null;
  onOpenInsights: () => void;
  onOpenAgents: () => void;
  onOpenProjeto?: (id: string) => void;
  agentsPending?: number;
}) {
  const [view, setView] = useState<
    'overview' | 'ganhos' | 'risco' | 'areas' | 'pep'
  >('overview');
  const [areaFilter, setAreaFilter] = useState('all');
  const [anoFilter, setAnoFilter] = useState<'all' | number>('all');
  const [escopoFilter, setEscopoFilter] = useState<
    'all' | 'comercial' | 'industrial'
  >('all');
  const [racionalKpi, setRacionalKpi] = useState<PotencialKpiId | null>(null);
  const [racionalQuery, setRacionalQuery] = useState('');
  const [racionalExpandido, setRacionalExpandido] = useState<string | null>(
    null,
  );

  const projects = useMemo(() => {
    return (portfolio?.porProjeto || []).map((p: any) => ({
      ...p,
      health: p.health || healthFromBrr(p.brr),
      area: p.area || 'Área',
      escopoNegocio: p.escopoNegocio || 'industrial',
      ano: p.ano ?? null,
    }));
  }, [portfolio]);

  const areas = useMemo(() => {
    const set = new Set<string>();
    for (const p of projects) set.add(String(p.area || 'Área'));
    return Array.from(set).sort();
  }, [projects]);

  const anos = useMemo(() => {
    const fromPortfolio = (portfolio?.anos || []) as number[];
    if (fromPortfolio.length) return [...fromPortfolio].sort((a, b) => a - b);
    const set = new Set<number>();
    for (const p of projects) {
      if (typeof p.ano === 'number') set.add(p.ano);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [portfolio, projects]);

  const filtered = useMemo(() => {
    return projects.filter((p: any) => {
      if (areaFilter !== 'all' && p.area !== areaFilter) return false;
      if (escopoFilter !== 'all' && p.escopoNegocio !== escopoFilter)
        return false;
      if (anoFilter !== 'all') {
        if (p.ano == null || p.ano !== anoFilter) return false;
      }
      return true;
    });
  }, [projects, areaFilter, escopoFilter, anoFilter]);

  const metrics = useMemo(() => {
    const prometido = filtered.reduce(
      (s: number, p: any) => s + nVal(p.prometido),
      0,
    );
    const realizado = filtered.reduce(
      (s: number, p: any) => s + nVal(p.realizado),
      0,
    );
    const custo = filtered.reduce(
      (s: number, p: any) => s + nVal(p.custoRealizado),
      0,
    );
    const hardMed = filtered.reduce(
      (s: number, p: any) => s + nVal(p.porCategoria?.hard),
      0,
    );
    const soft = filtered.reduce(
      (s: number, p: any) => s + nVal(p.porCategoria?.soft),
      0,
    );
    const hard = hardMed > 0 ? hardMed : realizado;
    const roi = custo === 0 ? null : (realizado - custo) / custo;
    const { potencial, investimento } = computePotencialFromProjects(filtered);
    const curvaS = buildCurvaSFromProjects(filtered, anoFilter);
    return {
      prometido,
      realizado,
      custo,
      hard,
      soft,
      roi,
      roiLabel:
        roi === null ? 'ROI não calculável' : `${(roi * 100).toFixed(1)}%`,
      potencial,
      investimento,
      curvaS,
    };
  }, [filtered, anoFilter]);

  const racional = useMemo(
    () => (racionalKpi ? buildRacional(racionalKpi, filtered) : null),
    [racionalKpi, filtered],
  );

  useEffect(() => {
    setRacionalQuery('');
    setRacionalExpandido(null);
  }, [racionalKpi]);

  const racionalRowsFiltradas = useMemo(() => {
    if (!racional) return [];
    const q = racionalQuery.trim().toLowerCase();
    if (!q) return racional.rows;
    return racional.rows.filter(
      (r) =>
        r.nome.toLowerCase().includes(q) ||
        r.area.toLowerCase().includes(q) ||
        (r.status || '').toLowerCase().includes(q) ||
        (r.detalhe || '').toLowerCase().includes(q),
    );
  }, [racional, racionalQuery]);

  const racionalTop = useMemo(() => {
    if (!racional?.rows.length || racional.unit === 'count') return null;
    const top = racional.rows.slice(0, 3);
    const somaTop = top.reduce((s, r) => s + r.valor, 0);
    const pct =
      racional.total > 0 ? Math.round((somaTop / racional.total) * 100) : 0;
    return { top, pct };
  }, [racional]);

  function fecharRacional() {
    setRacionalKpi(null);
    setRacionalQuery('');
    setRacionalExpandido(null);
  }

  if (!portfolio) {
    return (
      <section className="panel">
        <p className="muted">Carregando analytics de valor…</p>
      </section>
    );
  }

  const prometido = metrics.prometido;
  const realizado = metrics.realizado;
  const custo = metrics.custo;
  const hard = metrics.hard;
  const soft = metrics.soft;
  const potencial = metrics.potencial;
  const investimento = metrics.investimento;
  const capturePct = prometido > 0 ? (realizado / prometido) * 100 : 0;
  const roiPct = metrics.roi == null ? null : Number(metrics.roi) * 100;
  const sparkRealizado = metrics.curvaS.map(
    (c) => Number(c.realizadoAcumulado) || 0,
  );
  const sparkPlanejado = metrics.curvaS.map(
    (c) => Number(c.planejadoAcumulado) || 0,
  );
  const healthCounts = {
    green: filtered.filter((p: any) => p.health === 'green').length,
    yellow: filtered.filter((p: any) => p.health === 'yellow').length,
    red: filtered.filter((p: any) => p.health === 'red').length,
  };

  const byArea = areas
    .map((area) => {
      const items = filtered.filter((p: any) => p.area === area);
      if (!items.length) return null;
      const real = items.reduce(
        (s: number, p: any) => s + Number(p.realizado || 0),
        0,
      );
      const prom = items.reduce(
        (s: number, p: any) => s + Number(p.prometido || 0),
        0,
      );
      const risk = items.filter((p: any) => p.health !== 'green').length;
      return { area, real, prom, risk, count: items.length };
    })
    .filter(Boolean) as Array<{
    area: string;
    real: number;
    prom: number;
    risk: number;
    count: number;
  }>;

  const attention = [...filtered]
    .sort((a: any, b: any) => Number(a.brr ?? 1) - Number(b.brr ?? 1))
    .slice(0, 6);

  const prescriptions = [
    healthCounts.red > 0 && {
      tone: 'danger',
      title: `${healthCounts.red} projeto(s) em situação crítica`,
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

  const filterToolbar = (
    <div className="toolbar">
      <label className="field" style={{ margin: 0, minWidth: 140 }}>
        Ano
        <select
          value={anoFilter === 'all' ? 'all' : String(anoFilter)}
          onChange={(e) =>
            setAnoFilter(
              e.target.value === 'all' ? 'all' : Number(e.target.value),
            )
          }
        >
          <option value="all">Todos</option>
          {anos.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      <label className="field" style={{ margin: 0, minWidth: 160 }}>
        Projeto
        <select
          value={escopoFilter}
          onChange={(e) =>
            setEscopoFilter(
              e.target.value as 'all' | 'comercial' | 'industrial',
            )
          }
        >
          <option value="all">Todos</option>
          <option value="industrial">Industrial</option>
          <option value="comercial">Comercial</option>
        </select>
      </label>
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
      <span className="badge warning">
        {healthCounts.red + healthCounts.yellow} em risco
      </span>
    </div>
  );

  if (racional) {
    const somaFiltrada =
      racional.unit === 'count'
        ? racionalRowsFiltradas.length
        : racionalRowsFiltradas.reduce((s, r) => s + r.valor, 0);

    return (
      <div className="analytics racional-page">
        <header className="racional-page-header">
          <div className="racional-page-title">
            <button type="button" className="btn secondary" onClick={fecharRacional}>
              ← Voltar ao potencial
            </button>
            <div>
              <p className="eyebrow">Racional do cálculo</p>
              <h1>{racional.title}</h1>
              <p className="racional-formula">{racional.formula}</p>
            </div>
          </div>
          <div className="racional-page-kpis">
            <div className="racional-stat">
              <span className="label">Total</span>
              <strong>{formatRacionalValor(racional.unit, racional.total)}</strong>
            </div>
            <div className="racional-stat">
              <span className="label">Projetos</span>
              <strong>{racional.rows.length}</strong>
            </div>
            {racionalTop ? (
              <div className="racional-stat">
                <span className="label">Top 3</span>
                <strong>{racionalTop.pct}%</strong>
                <span className="muted">do total</span>
              </div>
            ) : null}
          </div>
        </header>

        {racionalTop ? (
          <section className="racional-summary">
            <h2>Maiores contribuições</h2>
            <div className="racional-top-grid">
              {racionalTop.top.map((r, i) => (
                <article
                  key={r.projetoId}
                  className={`racional-top-card${onOpenProjeto ? ' attention-card-btn' : ''}`}
                  role={onOpenProjeto ? 'button' : undefined}
                  tabIndex={onOpenProjeto ? 0 : undefined}
                  onClick={() => onOpenProjeto?.(r.projetoId)}
                  onKeyDown={(e) => {
                    if (!onOpenProjeto) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenProjeto(r.projetoId);
                    }
                  }}
                >
                  <span className="racional-rank">{i + 1}</span>
                  <div>
                    <strong>{r.nome}</strong>
                    <span className="muted">
                      {r.area}
                      {r.status ? ` · ${r.status}` : ''}
                    </span>
                  </div>
                  <em>{formatRacionalValor(racional.unit, r.valor)}</em>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="panel racional-table-panel">
          <div className="racional-toolbar">
            <input
              type="search"
              className="racional-search"
              placeholder="Buscar projeto, área ou status…"
              value={racionalQuery}
              onChange={(e) => setRacionalQuery(e.target.value)}
              autoFocus
            />
            <span className="muted">
              {racionalRowsFiltradas.length} de {racional.rows.length}
            </span>
          </div>

          {!racional.rows.length ? (
            <p className="muted">Nenhum projeto contribui para este indicador.</p>
          ) : !racionalRowsFiltradas.length ? (
            <p className="muted">Nenhum resultado para a busca.</p>
          ) : (
            <div className="racional-table-wrap">
              <table className="racional-table">
                <thead>
                  <tr>
                    <th className="col-rank">#</th>
                    <th>Projeto</th>
                    <th className="col-area">Área</th>
                    <th className="col-status">Status</th>
                    <th className="col-detail">Detalhe</th>
                    <th className="col-value">Valor</th>
                    <th className="col-memo">Memória</th>
                  </tr>
                </thead>
                <tbody>
                  {racionalRowsFiltradas.map((r, idx) => {
                    const aberto = racionalExpandido === r.projetoId;
                    const temMemo = Boolean(r.racional?.trim());
                    return (
                      <Fragment key={r.projetoId}>
                        <tr className={aberto ? 'is-open' : undefined}>
                          <td className="col-rank">{idx + 1}</td>
                          <td>
                            {onOpenProjeto ? (
                              <button
                                type="button"
                                className="linkish racional-proj-name"
                                onClick={() => onOpenProjeto(r.projetoId)}
                              >
                                {r.nome}
                              </button>
                            ) : (
                              <strong className="racional-proj-name">{r.nome}</strong>
                            )}
                          </td>
                          <td className="col-area">{r.area}</td>
                          <td className="col-status">{r.status || '—'}</td>
                          <td className="col-detail">{r.detalhe || '—'}</td>
                          <td className="col-value">
                            {formatRacionalValor(racional.unit, r.valor)}
                          </td>
                          <td className="col-memo">
                            {temMemo ? (
                              <button
                                type="button"
                                className="linkish"
                                onClick={() =>
                                  setRacionalExpandido(
                                    aberto ? null : r.projetoId,
                                  )
                                }
                              >
                                {aberto ? 'Ocultar' : 'Ver'}
                              </button>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                        </tr>
                        {aberto && temMemo ? (
                          <tr className="racional-memo-row">
                            <td colSpan={7}>
                              <div className="racional-detail-label">
                                Memória / racional · {r.nome}
                              </div>
                              <pre className="racional-detail-text">{r.racional}</pre>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5}>
                      <strong>Soma filtrada</strong>
                    </td>
                    <td className="col-value">
                      <strong>
                        {formatRacionalValor(racional.unit, somaFiltrada)}
                      </strong>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="analytics">
      <div className="analytics-hero">
        <div className="top-actions">
          <button className="btn secondary" onClick={onOpenInsights}>
            Insights
          </button>
        </div>
      </div>

      {filterToolbar}

      <div className="analytics-tabs">
        {(
          [
            ['overview', 'Overview'],
            ['ganhos', 'Ganhos'],
            ['risco', 'Risco'],
            ['areas', 'Áreas'],
            ['pep', 'Custos PEP'],
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

      {view === 'pep' ? (
        <PepCustosPanel
          onOpenProjeto={onOpenProjeto}
          anoFilter={anoFilter}
          escopoFilter={escopoFilter}
          areaFilter={areaFilter}
        />
      ) : (
        <>
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
              <div className="value">{metrics.roiLabel}</div>
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
              <div className="label">Projetos em risco</div>
              <div className="value">{healthCounts.red + healthCounts.yellow}</div>
              <div className={`trend ${(healthCounts.red + healthCounts.yellow) === 0 ? 'up' : 'down'}`}>
                {healthCounts.red} crítico(s) · {healthCounts.yellow} atenção
              </div>
            </div>
            <Sparkline
              values={filtered.map((p: any) =>
                p.health === 'green' ? 100 : p.health === 'yellow' ? 50 : 15,
              )}
              color="#e56910"
            />
          </div>
        </article>
      </div>

      {(view === 'overview' || view === 'ganhos') && (
        <section className="panel potencial-panel">
          <div className="panel-head">
            <h2>Potencial de ganhos (declarado)</h2>
            <span className="meta">
              {portfolio.atualizadoEm
                ? `Atualizado ${new Date(portfolio.atualizadoEm).toLocaleString('pt-BR')}`
                : '—'}
            </span>
          </div>
          <p className="muted" style={{ marginTop: 0 }}>
            Valores informados na ficha — distintos do realizado homologado
            acima. Clique em um card para ver o racional do cálculo.
            {potencial?.excluidos
              ? ` ${potencial.excluidos} projeto(s) excluído(s) do potencial (suspenso/cancelado).`
              : ''}
          </p>
          <div className="kpi-row potencial-row">
            <button
              type="button"
              className="kpi-card kpi-card-btn"
              onClick={() => setRacionalKpi('quantitativos')}
            >
              <div className="label">Projetos quantitativos</div>
              <div className="value">
                {potencial?.projetosQuantitativos ?? '—'}
              </div>
              <div className="trend">
                {potencial?.pctQuantitativos == null
                  ? '—'
                  : `${Number(potencial.pctQuantitativos).toFixed(0)}% do classificado`}
              </div>
            </button>
            <button
              type="button"
              className="kpi-card kpi-card-btn"
              onClick={() => setRacionalKpi('ganho_estimado')}
            >
              <div className="label">Ganho estimado</div>
              <div className="value">
                {fmtOrDash(potencial?.ganhoFinanceiroAnual, brl)}
              </div>
            </button>
            <button
              type="button"
              className="kpi-card kpi-card-btn"
              onClick={() => setRacionalKpi('risco')}
            >
              <div className="label">Risco fin. mitigado</div>
              <div className="value">
                {fmtOrDash(potencial?.riscoFinanceiroMitigadoAnual, brl)}
              </div>
            </button>
            <button
              type="button"
              className="kpi-card kpi-card-btn"
              onClick={() => setRacionalKpi('negocio')}
            >
              <div className="label">Ganho do negócio</div>
              <div className="value">
                {fmtOrDash(potencial?.ganhoNegocioAnual, brl)}
              </div>
            </button>
            <button
              type="button"
              className="kpi-card kpi-card-btn"
              onClick={() => setRacionalKpi('horas')}
            >
              <div className="label">Horas economizadas</div>
              <div className="value">
                {fmtOrDash(potencial?.horasEconomizadasAno, (n) =>
                  `${new Intl.NumberFormat('pt-BR').format(n)} h`,
                )}
              </div>
            </button>
          </div>
          <div className="kpi-row potencial-row" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="kpi-card kpi-card-btn"
              onClick={() => setRacionalKpi('recorrentes')}
            >
              <div className="label">Recorrentes (anual)</div>
              <div className="value">
                {fmtOrDash(potencial?.recorrente?.anual, brl)}
              </div>
              <div className="trend">
                {potencial?.recorrente?.projetos ?? 0} proj. · ×3 anos:{' '}
                {fmtOrDash(potencial?.recorrente?.horizonte3Anos, brl)}
              </div>
            </button>
            <button
              type="button"
              className="kpi-card kpi-card-btn"
              onClick={() => setRacionalKpi('pontuais')}
            >
              <div className="label">Pontuais (uma vez)</div>
              <div className="value">
                {fmtOrDash(potencial?.pontual?.total, brl)}
              </div>
              <div className="trend">
                {potencial?.pontual?.projetos ?? 0} projetos
              </div>
            </button>
            <button
              type="button"
              className="kpi-card kpi-card-btn"
              onClick={() => setRacionalKpi('horizonte3')}
            >
              <div className="label">Horizonte 3 anos</div>
              <div className="value">
                {fmtOrDash(potencial?.horizonte3Anos, brl)}
              </div>
              <div className="trend">recorrente×3 + pontual</div>
            </button>
            <button
              type="button"
              className="kpi-card kpi-card-btn"
              onClick={() => setRacionalKpi('qualitativos')}
            >
              <div className="label">Projetos qualitativos</div>
              <div className="value">
                {potencial?.projetosQualitativos ?? '—'}
              </div>
              <div className="trend">
                {potencial?.pctQualitativos == null
                  ? '—'
                  : `${Number(potencial.pctQualitativos).toFixed(0)}% do classificado`}
              </div>
            </button>
          </div>
          <div className="kpi-row potencial-row" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="kpi-card kpi-card-btn"
              onClick={() => setRacionalKpi('capex')}
            >
              <div className="label">Investimento CAPEX</div>
              <div className="value">{fmtOrDash(investimento?.capex, brl)}</div>
            </button>
            <button
              type="button"
              className="kpi-card kpi-card-btn"
              onClick={() => setRacionalKpi('opex')}
            >
              <div className="label">Investimento OPEX</div>
              <div className="value">{fmtOrDash(investimento?.opex, brl)}</div>
            </button>
            <button
              type="button"
              className="kpi-card kpi-card-btn"
              onClick={() => setRacionalKpi('capex_opex_pend')}
            >
              <div className="label">CAPEX → OPEX pendente</div>
              <div className="value">
                {fmtOrDash(investimento?.capexParaOpexPendente, brl)}
              </div>
              <div className="trend">aplica ao Encerrar / Sustentação</div>
            </button>
            <button
              type="button"
              className="kpi-card kpi-card-btn"
              onClick={() => setRacionalKpi('capex_opex_aplic')}
            >
              <div className="label">CAPEX → OPEX aplicado</div>
              <div className="value">
                {fmtOrDash(investimento?.capexParaOpexAplicado, brl)}
              </div>
            </button>
          </div>
        </section>
      )}

      {(view === 'overview' || view === 'ganhos') && (
        <div className="dash-grid">
          <section className="panel">
            <div className="panel-head">
              <h2>Ganhos por categoria</h2>
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
        <CurvaSCompact data={metrics.curvaS} />
      </section>

      {(view === 'overview' || view === 'areas' || view === 'risco') && (
        <section className="panel">
          <div className="panel-head">
            <h2>Programas que precisam de atenção</h2>
            <span className="meta">Prioridade por saúde / ROI</span>
          </div>
          <div className="attention-grid">
            {attention.slice(0, 3).map((p: any, idx: number) => {
              const capturaPct =
                Number(p.prometido) > 0
                  ? (Number(p.realizado) / Number(p.prometido)) * 100
                  : 0;
              return (
                <article
                  className={`attention-card${onOpenProjeto ? ' attention-card-btn' : ''}`}
                  key={p.projetoId}
                  role={onOpenProjeto ? 'button' : undefined}
                  tabIndex={onOpenProjeto ? 0 : undefined}
                  onClick={() => onOpenProjeto?.(p.projetoId)}
                  onKeyDown={(e) => {
                    if (!onOpenProjeto) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenProjeto(p.projetoId);
                    }
                  }}
                >
                  <div className="attention-head">
                    <span className="muted">{idx + 1}. {p.area || 'Área'}</span>
                    <span className={`badge ${p.health === 'green' ? 'done' : p.health === 'yellow' ? 'warning' : 'danger'}`}>
                      {p.health === 'green' ? 'On track' : p.health === 'yellow' ? 'At risk' : 'Delayed'}
                    </span>
                  </div>
                  <h3>{p.nome}</h3>
                  <div className="attention-metric">
                    {capturaPct.toFixed(0)}% capturado
                  </div>
                  <div className="progress-track">
                    <i
                      className={p.health === 'green' ? 'done' : 'progress'}
                      style={{
                        width: `${Math.min(100, capturaPct)}%`,
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
          <h2>Prescrições · Agents</h2>
        </div>
        <div className="prescription-list">
          {prescriptions.slice(0, 2).map((p) => (
            <div key={p.title} className={`prescription tone-${p.tone}`}>
              <strong>{p.title}</strong>
              <span>{p.text}</span>
            </div>
          ))}
          <div className="actions" style={{ marginTop: 4 }}>
            <button className="btn" onClick={onOpenAgents}>
              Ver fila em Agents
              {agentsPending > 0 ? ` (${agentsPending})` : ''}
            </button>
          </div>
        </div>
      </section>
        </>
      )}
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
    </div>
  );
}
