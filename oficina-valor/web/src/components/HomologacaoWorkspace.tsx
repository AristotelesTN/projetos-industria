import { useCallback, useEffect, useState } from 'react';
import { api, brl } from '../lib/api';

type Pendente = {
  id: string;
  periodoReferencia: string;
  valorRealizado: string | number;
  comentario?: string | null;
  registradaEm: string;
  beneficio?: {
    nome?: string;
    categoria?: string;
    businessCase?: { projeto?: { id?: string; nome?: string } };
    centroCusto?: { codigo?: string; nome?: string };
  };
  evidencias?: { id: string; nomeArquivo: string }[];
  registradaPor?: { nome?: string; email?: string };
};

export function HomologacaoWorkspace({
  onMessage,
  onError,
  onOpenWizard,
}: {
  onMessage: (m: string) => void;
  onError: (m: string) => void;
  onOpenWizard: () => void;
}) {
  const [items, setItems] = useState<Pendente[]>([]);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Pendente | null>(null);
  const [comentario, setComentario] = useState('');

  const load = useCallback(async () => {
    try {
      const list = await api.pendentes();
      setItems(list);
      setSelected((cur) => {
        if (!cur) return list[0] || null;
        return list.find((x: Pendente) => x.id === cur.id) || list[0] || null;
      });
    } catch (e: any) {
      onError(e.message || String(e));
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(decisao: 'aprovada' | 'rejeitada') {
    if (!selected) return;
    if (decisao === 'rejeitada' && !comentario.trim()) {
      onError('Informe um comentário para rejeitar');
      return;
    }
    setBusy(true);
    try {
      await api.validar(selected.id, decisao, comentario.trim() || undefined);
      onMessage(
        decisao === 'aprovada'
          ? `Medição aprovada · ${selected.beneficio?.nome || selected.id}`
          : `Medição rejeitada · ${selected.beneficio?.nome || selected.id}`,
      );
      setComentario('');
      await load();
    } catch (e: any) {
      onError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="homolog">
      <div className="portfolio-toolbar">
        <div>
          <h2 className="section-title">Fila de homologação</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Valide medições submetidas pelo Wizard antes de contabilizar no ROI.
          </p>
        </div>
        <div className="top-actions">
          <span className="badge warning">{items.length} pendentes</span>
          <button className="btn secondary" disabled={busy} onClick={() => void load()}>
            Atualizar
          </button>
          <button className="btn" onClick={onOpenWizard}>
            + Registrar ganho
          </button>
        </div>
      </div>

      {!items.length ? (
        <section className="panel empty-state">
          <strong>Fila vazia</strong>
          <span>Nenhuma medição aguardando validação.</span>
          <button className="btn" onClick={onOpenWizard}>
            Abrir Wizard
          </button>
        </section>
      ) : (
        <div className="homolog-layout">
          <section className="panel homolog-list">
            <div className="panel-head">
              <h2>Pendentes</h2>
              <span className="meta">{items.length}</span>
            </div>
            <div className="homolog-rows">
              {items.map((m) => {
                const projeto = m.beneficio?.businessCase?.projeto?.nome || 'Projeto';
                const active = selected?.id === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={`homolog-row ${active ? 'active' : ''}`}
                    onClick={() => {
                      setSelected(m);
                      setComentario('');
                    }}
                  >
                    <div className="homolog-row-main">
                      <strong>{m.beneficio?.nome || 'Benefício'}</strong>
                      <span className="muted">{projeto}</span>
                    </div>
                    <div className="homolog-row-side">
                      <strong>{brl(m.valorRealizado)}</strong>
                      <span className="muted">
                        {new Date(m.periodoReferencia).toLocaleDateString('pt-BR', {
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {selected && (
            <section className="panel homolog-detail">
              <div className="panel-head">
                <h2>Revisão</h2>
                <span className="badge warning">Pendente</span>
              </div>
              <div className="stack">
                <div className="detail-kv">
                  <span>Projeto</span>
                  <strong>
                    {selected.beneficio?.businessCase?.projeto?.nome || '—'}
                  </strong>
                </div>
                <div className="detail-kv">
                  <span>Benefício</span>
                  <strong>{selected.beneficio?.nome || '—'}</strong>
                </div>
                <div className="detail-kv">
                  <span>Categoria</span>
                  <strong>{selected.beneficio?.categoria || '—'}</strong>
                </div>
                <div className="detail-kv">
                  <span>Valor realizado</span>
                  <strong className="tone-green">{brl(selected.valorRealizado)}</strong>
                </div>
                <div className="detail-kv">
                  <span>Período</span>
                  <strong>
                    {new Date(selected.periodoReferencia).toLocaleDateString('pt-BR')}
                  </strong>
                </div>
                <div className="detail-kv">
                  <span>Registrado por</span>
                  <strong>
                    {selected.registradaPor?.nome ||
                      selected.registradaPor?.email ||
                      '—'}
                  </strong>
                </div>
                {selected.comentario && (
                  <div className="detail-kv">
                    <span>Comentário</span>
                    <strong>{selected.comentario}</strong>
                  </div>
                )}
                <div className="detail-kv">
                  <span>Evidências</span>
                  <strong>
                    {selected.evidencias?.length
                      ? selected.evidencias.map((e) => e.nomeArquivo).join(', ')
                      : 'Nenhuma anexada'}
                  </strong>
                </div>
                <label className="field">
                  Comentário da validação
                  <textarea
                    rows={3}
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    placeholder="Obrigatório para rejeição"
                  />
                </label>
                <div className="actions">
                  <button
                    className="btn reject"
                    disabled={busy}
                    onClick={() => void decide('rejeitada')}
                  >
                    Rejeitar
                  </button>
                  <button
                    className="btn accept"
                    disabled={busy}
                    onClick={() => void decide('aprovada')}
                  >
                    Aprovar
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
