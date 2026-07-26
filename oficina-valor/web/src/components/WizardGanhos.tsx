import { useMemo, useState } from 'react';
import { api, brl } from '../lib/api';

type Step =
  | 'tipo'
  | 'respondente'
  | 'adocao'
  | 'ramo'
  | 'retry'
  | 'calc'
  | 'done';

const RAMOS = [
  {
    id: 'producao',
    label: 'Produção',
    desc: 'Δ volume × margem de contribuição',
    cat: 'hard',
  },
  {
    id: 'reducao_custos',
    label: 'Redução de custos/materiais',
    desc: 'Gasto antes vs agora · fonte almoxarifado',
    cat: 'hard',
  },
  {
    id: 'tempo_produtividade',
    label: 'Tempo / produtividade',
    desc: 'Δ tempo × pessoas × frequência × custo-hora',
    cat: 'soft',
  },
  {
    id: 'qualitativo_qualidade',
    label: 'Qualidade / NPS',
    desc: 'Impacto qualitativo (não soma no ROI)',
    cat: 'estrategico',
  },
  {
    id: 'qualitativo_risco',
    label: 'Mitigação de riscos',
    desc: 'Probabilidade × impacto antes/depois',
    cat: 'estrategico',
  },
  {
    id: 'sem_ganhos',
    label: 'Sem ganhos identificados',
    desc: 'Requer segundo ciclo (RF-26c)',
    cat: '—',
  },
] as const;

export function WizardGanhos({
  projetos,
  selectedId,
  onSelectProjeto,
  onDone,
  onError,
  onMessage,
}: {
  projetos: any[];
  selectedId: string | null;
  onSelectProjeto: (id: string) => void;
  onDone: () => void;
  onError: (e: string) => void;
  onMessage: (m: string) => void;
}) {
  const [step, setStep] = useState<Step>('tipo');
  const [tipo, setTipo] = useState<'baseline' | 'realizacao'>('baseline');
  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [respondenteNome, setRespondenteNome] = useState('');
  const [conhece, setConhece] = useState(true);
  const [encaminharPara, setEncaminharPara] = useState('');
  const [adotado, setAdotado] = useState(true);
  const [causaNaoAdocao, setCausaNaoAdocao] = useState('');
  const [ramo, setRamo] = useState<string>('producao');
  const [cicloRetry, setCicloRetry] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [calc, setCalc] = useState({
    volumeAntes: '1000',
    volumeAgora: '1200',
    margemContribuicao: '15',
    gastoAntes: '50000',
    gastoAgora: '42000',
    custoUnitario: '10',
    fonteCusto: 'Almoxarifado SAP',
    tempoAntesMin: '60',
    tempoAgoraMin: '40',
    pessoas: '3',
    frequenciaSemanal: '5',
    custoHora: '80',
    escalaSatisfacao: '8',
    nps: '40',
    riscoProbAntes: '0.4',
    riscoImpactoAntes: '100000',
    riscoProbDepois: '0.1',
    riscoImpactoDepois: '100000',
    descricaoQualitativa: '',
    janelaMeses: '12',
  });

  const projeto = useMemo(
    () => projetos.find((p) => p.id === selectedId) || null,
    [projetos, selectedId],
  );

  const preview = useMemo(() => {
    const n = (k: keyof typeof calc) => Number(calc[k] || 0);
    if (ramo === 'producao') {
      return Math.max(0, (n('volumeAgora') - n('volumeAntes')) * n('margemContribuicao'));
    }
    if (ramo === 'reducao_custos') {
      return Math.max(0, n('gastoAntes') - n('gastoAgora'));
    }
    if (ramo === 'tempo_produtividade') {
      const deltaMin = n('tempoAntesMin') - n('tempoAgoraMin');
      const horas = (deltaMin / 60) * n('pessoas') * n('frequenciaSemanal');
      return Math.max(0, horas * 4.33 * n('custoHora'));
    }
    if (ramo === 'qualitativo_risco') {
      const antes = n('riscoProbAntes') * n('riscoImpactoAntes');
      const depois = n('riscoProbDepois') * n('riscoImpactoDepois');
      return Math.max(0, (antes - depois) / 12);
    }
    return 0;
  }, [ramo, calc]);

  async function startWizard() {
    if (!selectedId) {
      onError('Selecione um projeto');
      return;
    }
    setBusy(true);
    try {
      if (!conhece && encaminharPara.trim()) {
        const s = await api.startWizard(selectedId, {
          tipo,
          respondenteNome: respondenteNome || undefined,
          conheceProjeto: false,
        });
        await api.encaminharWizard(s.id, { encaminhadoPara: encaminharPara });
        onMessage(`Wizard encaminhado para ${encaminharPara}`);
        setStep('done');
        setResult({ encaminhado: true, para: encaminharPara });
        return;
      }
      const s = await api.startWizard(selectedId, {
        tipo,
        respondenteNome: respondenteNome || undefined,
        conheceProjeto: conhece,
      });
      setSessaoId(s.id);
      setStep(tipo === 'realizacao' ? 'adocao' : 'ramo');
    } catch (e: any) {
      onError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function finish(opts?: { forcarSemGanhos?: boolean }) {
    if (!sessaoId) return;
    setBusy(true);
    try {
      if (tipo === 'realizacao' && !adotado) {
        const res = await api.completeWizard(sessaoId, {
          adotado: false,
          causaNaoAdocao,
        });
        setResult(res);
        setStep('done');
        onMessage('Projeto marcado SEM GANHOS — não adotado');
        onDone();
        return;
      }

      if (ramo === 'sem_ganhos' && cicloRetry < 1 && !opts?.forcarSemGanhos) {
        const res = await api.completeWizard(sessaoId, {
          ramo: 'sem_ganhos',
          cicloRetry: 0,
          adotado,
        });
        if (res.status !== 'concluido') {
          setCicloRetry(1);
          setStep('retry');
          onMessage('Revise as categorias com exemplos antes de concluir SEM GANHOS');
          return;
        }
      }

      const payload: any = {
        ramo,
        cicloRetry,
        adotado,
        forcarSemGanhos: opts?.forcarSemGanhos || cicloRetry >= 1,
        calc: {
          volumeAntes: Number(calc.volumeAntes),
          volumeAgora: Number(calc.volumeAgora),
          margemContribuicao: Number(calc.margemContribuicao),
          gastoAntes: Number(calc.gastoAntes),
          gastoAgora: Number(calc.gastoAgora),
          custoUnitario: Number(calc.custoUnitario),
          fonteCusto: calc.fonteCusto,
          tempoAntesMin: Number(calc.tempoAntesMin),
          tempoAgoraMin: Number(calc.tempoAgoraMin),
          pessoas: Number(calc.pessoas),
          frequenciaSemanal: Number(calc.frequenciaSemanal),
          custoHora: Number(calc.custoHora),
          escalaSatisfacao: Number(calc.escalaSatisfacao),
          nps: Number(calc.nps),
          riscoProbAntes: Number(calc.riscoProbAntes),
          riscoImpactoAntes: Number(calc.riscoImpactoAntes),
          riscoProbDepois: Number(calc.riscoProbDepois),
          riscoImpactoDepois: Number(calc.riscoImpactoDepois),
          descricaoQualitativa: calc.descricaoQualitativa,
          janelaMeses: Number(calc.janelaMeses),
        },
      };

      const res = await api.completeWizard(sessaoId, payload);
      if (res.sessao || res.status === 'concluido' || res.beneficio) {
        setResult(res.sessao || res);
        setStep('done');
        onMessage(
          tipo === 'baseline'
            ? 'Baseline criada via wizard — G2 liberado após premissas'
            : 'Medição gerada — vá à Homologação',
        );
        onDone();
      } else if (res.cicloRetry === 1) {
        setCicloRetry(1);
        setStep('retry');
      } else {
        setResult(res);
        setStep('done');
        onDone();
      }
    } catch (e: any) {
      onError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  function setField(key: keyof typeof calc, value: string) {
    setCalc((c) => ({ ...c, [key]: value }));
  }

  const steps = ['tipo', 'respondente', 'adocao', 'ramo', 'calc', 'done'] as const;
  const stepIdx =
    step === 'retry' ? 3 : Math.max(0, steps.indexOf(step as (typeof steps)[number]));

  return (
    <div className="wizard">
      <div className="wizard-progress">
        {['Tipo', 'Respondente', 'Adoção', 'Ramo', 'Cálculo', 'Fim'].map((label, i) => (
          <div key={label} className={`wizard-step ${i <= stepIdx ? 'done' : ''}`}>
            <span>{i + 1}</span>
            {label}
          </div>
        ))}
      </div>

      <div className="wizard-body">
        <aside className="wizard-side">
          <h3>Projeto</h3>
          <label className="field">
            Selecionar
            <select
              value={selectedId || ''}
              onChange={(e) => onSelectProjeto(e.target.value)}
            >
              <option value="" disabled>
                Escolha…
              </option>
              {projetos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
          {projeto && (
            <div className="muted" style={{ marginTop: 12, fontSize: 12 }}>
              Status: <span className="badge in-progress">{projeto.status}</span>
              <br />
              Baseline wizard:{' '}
              {projeto.wizardBaselineCompleto ? (
                <span className="badge done">completo</span>
              ) : (
                <span className="badge warning">pendente</span>
              )}
            </div>
          )}
        </aside>

        <section className="wizard-main panel">
          {step === 'tipo' && (
            <>
              <h2>Wizard de Análise de Ganhos</h2>
              <div className="wizard-cards">
                <button
                  type="button"
                  className={`wizard-card ${tipo === 'baseline' ? 'active' : ''}`}
                  onClick={() => setTipo('baseline')}
                >
                  <strong>Pré-projeto (baseline)</strong>
                </button>
                <button
                  type="button"
                  className={`wizard-card ${tipo === 'realizacao' ? 'active' : ''}`}
                  onClick={() => setTipo('realizacao')}
                >
                  <strong>Pós-entrega (realização)</strong>
                </button>
              </div>
              <div className="actions">
                <button
                  className="btn"
                  disabled={!selectedId}
                  onClick={() => setStep('respondente')}
                >
                  Continuar
                </button>
              </div>
            </>
          )}

          {step === 'respondente' && (
            <>
              <h2>Identificação do respondente</h2>
              <div className="stack">
                <label className="field">
                  Quem está respondendo?
                  <input
                    value={respondenteNome}
                    onChange={(e) => setRespondenteNome(e.target.value)}
                    placeholder="Nome do colaborador"
                  />
                </label>
                <label className="field">
                  Conhece o projeto?
                  <select
                    value={conhece ? 'sim' : 'nao'}
                    onChange={(e) => setConhece(e.target.value === 'sim')}
                  >
                    <option value="sim">Sim</option>
                    <option value="nao">Não — encaminhar</option>
                  </select>
                </label>
                {!conhece && (
                  <label className="field">
                    Encaminhar para
                    <input
                      value={encaminharPara}
                      onChange={(e) => setEncaminharPara(e.target.value)}
                      placeholder="nome@empresa.com"
                    />
                  </label>
                )}
              </div>
              <div className="actions">
                <button className="btn secondary" onClick={() => setStep('tipo')}>
                  Voltar
                </button>
                <button className="btn" disabled={busy} onClick={startWizard}>
                  {conhece ? 'Iniciar questionário' : 'Encaminhar'}
                </button>
              </div>
            </>
          )}

          {step === 'adocao' && (
            <>
              <h2>Verificação de adoção</h2>
              <p className="muted">O projeto está em uso/funcionamento?</p>
              <div className="wizard-cards">
                <button
                  type="button"
                  className={`wizard-card ${adotado ? 'active' : ''}`}
                  onClick={() => setAdotado(true)}
                >
                  <strong>Sim, em uso</strong>
                  <span>Seguir para ramos de ganho</span>
                </button>
                <button
                  type="button"
                  className={`wizard-card ${!adotado ? 'active' : ''}`}
                  onClick={() => setAdotado(false)}
                >
                  <strong>Não adotado</strong>
                  <span>SEM GANHOS — registrar causa</span>
                </button>
              </div>
              {!adotado && (
                <label className="field" style={{ marginTop: 12 }}>
                  Causa do não-funcionamento (obrigatória)
                  <textarea
                    rows={3}
                    value={causaNaoAdocao}
                    onChange={(e) => setCausaNaoAdocao(e.target.value)}
                  />
                </label>
              )}
              <div className="actions">
                <button
                  className="btn"
                  disabled={busy || (!adotado && !causaNaoAdocao.trim())}
                  onClick={() => {
                    if (!adotado) void finish();
                    else setStep('ramo');
                  }}
                >
                  Continuar
                </button>
              </div>
            </>
          )}

          {(step === 'ramo' || step === 'retry') && (
            <>
              <h2>
                {step === 'retry'
                  ? 'Tentar novamente — se tirarmos o projeto, faria falta?'
                  : 'Tipo de ganho (árvore BPMN)'}
              </h2>
              {step === 'retry' && (
                <p className="ok">
                  Nenhuma categoria identificada no 1º ciclo. Revise com exemplos
                  antes de concluir SEM GANHOS.
                </p>
              )}
              <div className="wizard-cards">
                {RAMOS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`wizard-card ${ramo === r.id ? 'active' : ''}`}
                    onClick={() => setRamo(r.id)}
                  >
                    <strong>{r.label}</strong>
                    <span>
                      {r.desc} · <em>{r.cat}</em>
                    </span>
                  </button>
                ))}
              </div>
              <div className="actions">
                <button
                  className="btn"
                  onClick={() => {
                    if (ramo === 'sem_ganhos') void finish({ forcarSemGanhos: cicloRetry >= 1 });
                    else setStep('calc');
                  }}
                >
                  Continuar
                </button>
              </div>
            </>
          )}

          {step === 'calc' && (
            <>
              <h2>Calculadora · {RAMOS.find((r) => r.id === ramo)?.label}</h2>
              <p className="muted">
                Prévia mensal: <strong>{brl(preview)}</strong>
              </p>
              <div className="stack">
                {ramo === 'producao' && (
                  <>
                    <label className="field">
                      Volume antes
                      <input
                        type="number"
                        value={calc.volumeAntes}
                        onChange={(e) => setField('volumeAntes', e.target.value)}
                      />
                    </label>
                    <label className="field">
                      Volume agora
                      <input
                        type="number"
                        value={calc.volumeAgora}
                        onChange={(e) => setField('volumeAgora', e.target.value)}
                      />
                    </label>
                    <label className="field">
                      Margem de contribuição (Finanças)
                      <input
                        type="number"
                        value={calc.margemContribuicao}
                        onChange={(e) =>
                          setField('margemContribuicao', e.target.value)
                        }
                      />
                    </label>
                  </>
                )}
                {ramo === 'reducao_custos' && (
                  <>
                    <label className="field">
                      Gasto/consumo antes
                      <input
                        type="number"
                        value={calc.gastoAntes}
                        onChange={(e) => setField('gastoAntes', e.target.value)}
                      />
                    </label>
                    <label className="field">
                      Gasto/consumo agora
                      <input
                        type="number"
                        value={calc.gastoAgora}
                        onChange={(e) => setField('gastoAgora', e.target.value)}
                      />
                    </label>
                    <label className="field">
                      Fonte do custo unitário
                      <input
                        value={calc.fonteCusto}
                        onChange={(e) => setField('fonteCusto', e.target.value)}
                      />
                    </label>
                  </>
                )}
                {ramo === 'tempo_produtividade' && (
                  <>
                    <label className="field">
                      Tempo antes (min)
                      <input
                        type="number"
                        value={calc.tempoAntesMin}
                        onChange={(e) => setField('tempoAntesMin', e.target.value)}
                      />
                    </label>
                    <label className="field">
                      Tempo agora (min)
                      <input
                        type="number"
                        value={calc.tempoAgoraMin}
                        onChange={(e) => setField('tempoAgoraMin', e.target.value)}
                      />
                    </label>
                    <label className="field">
                      Pessoas
                      <input
                        type="number"
                        value={calc.pessoas}
                        onChange={(e) => setField('pessoas', e.target.value)}
                      />
                    </label>
                    <label className="field">
                      Frequência semanal
                      <input
                        type="number"
                        value={calc.frequenciaSemanal}
                        onChange={(e) =>
                          setField('frequenciaSemanal', e.target.value)
                        }
                      />
                    </label>
                    <label className="field">
                      Custo-hora médio
                      <input
                        type="number"
                        value={calc.custoHora}
                        onChange={(e) => setField('custoHora', e.target.value)}
                      />
                    </label>
                  </>
                )}
                {ramo === 'qualitativo_qualidade' && (
                  <>
                    <label className="field">
                      Escala satisfação (1–10)
                      <input
                        type="number"
                        value={calc.escalaSatisfacao}
                        onChange={(e) =>
                          setField('escalaSatisfacao', e.target.value)
                        }
                      />
                    </label>
                    <label className="field">
                      NPS
                      <input
                        type="number"
                        value={calc.nps}
                        onChange={(e) => setField('nps', e.target.value)}
                      />
                    </label>
                    <label className="field">
                      Descrição
                      <textarea
                        rows={3}
                        value={calc.descricaoQualitativa}
                        onChange={(e) =>
                          setField('descricaoQualitativa', e.target.value)
                        }
                      />
                    </label>
                  </>
                )}
                {ramo === 'qualitativo_risco' && (
                  <>
                    <label className="field">
                      Probabilidade antes (0–1)
                      <input
                        type="number"
                        step="0.01"
                        value={calc.riscoProbAntes}
                        onChange={(e) =>
                          setField('riscoProbAntes', e.target.value)
                        }
                      />
                    </label>
                    <label className="field">
                      Impacto antes (R$)
                      <input
                        type="number"
                        value={calc.riscoImpactoAntes}
                        onChange={(e) =>
                          setField('riscoImpactoAntes', e.target.value)
                        }
                      />
                    </label>
                    <label className="field">
                      Probabilidade depois (0–1)
                      <input
                        type="number"
                        step="0.01"
                        value={calc.riscoProbDepois}
                        onChange={(e) =>
                          setField('riscoProbDepois', e.target.value)
                        }
                      />
                    </label>
                    <label className="field">
                      Impacto depois (R$)
                      <input
                        type="number"
                        value={calc.riscoImpactoDepois}
                        onChange={(e) =>
                          setField('riscoImpactoDepois', e.target.value)
                        }
                      />
                    </label>
                  </>
                )}
                <label className="field">
                  Janela (meses)
                  <input
                    type="number"
                    value={calc.janelaMeses}
                    onChange={(e) => setField('janelaMeses', e.target.value)}
                  />
                </label>
              </div>
              <div className="actions">
                <button className="btn secondary" onClick={() => setStep('ramo')}>
                  Voltar
                </button>
                <button className="btn" disabled={busy} onClick={() => void finish()}>
                  Concluir wizard
                </button>
              </div>
            </>
          )}

          {step === 'done' && (
            <>
              <h2>Wizard concluído</h2>
              {result?.encaminhado ? (
                <p className="ok">Encaminhado para {result.para}</p>
              ) : (
                <div className="stack">
                  <p className="ok">Respostas registradas na trilha de auditoria.</p>
                  {result?.resultado && (
                    <pre className="wizard-result">
                      {JSON.stringify(result.resultado, null, 2)}
                    </pre>
                  )}
                  {result?.beneficio && (
                    <p className="muted">
                      Benefício {result.beneficio.nome} ·{' '}
                      {brl(Number(result.beneficio.valorMensalEsperado))}/mês
                    </p>
                  )}
                </div>
              )}
              <div className="actions">
                <button
                  className="btn"
                  onClick={() => {
                    setStep('tipo');
                    setSessaoId(null);
                    setResult(null);
                    setCicloRetry(0);
                  }}
                >
                  Novo wizard
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
