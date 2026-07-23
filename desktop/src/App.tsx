import { useEffect, useState, useTransition } from "react";
import { api, type IntakeResponse, type Message, type Treatment } from "./lib/api";
import { getSupabase } from "./lib/supabase";

const EXAMPLES = [
  "Amoxicilina 500mg de 8 em 8 horas por 7 dias, começando hoje às 14h. Me avisa 15 minutos antes.",
  "Dipirona 1g agora e depois de 6 em 6 horas por 3 dias, avisa 10 min antes.",
  "Losartana 50mg todo dia às 8h por 30 dias.",
];

function formatWhen(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function App() {
  const [text, setText] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [intake, setIntake] = useState<IntakeResponse | null>(null);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [whatsPhone, setWhatsPhone] = useState("");
  const [store, setStore] = useState("…");
  const [authEmail, setAuthEmail] = useState("");
  const [authInfo, setAuthInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const supabase = getSupabase();

  async function refresh() {
    const [health, tRes, mRes] = await Promise.all([
      api.health(),
      api.treatments(phone || undefined),
      api.messages(phone || undefined),
    ]);
    setStore(health.store);
    setTreatments(tRes.treatments ?? []);
    setMessages(mRes.messages ?? []);
    setWhatsPhone(mRes.phone ?? "");
  }

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
    const id = window.setInterval(() => {
      void api.tick().catch(() => undefined);
      void refresh().catch(() => undefined);
    }, 30000);
    return () => window.clearInterval(id);
  }, []);

  function submitIntake() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await api.intake(text, phone || undefined);
        setIntake(result);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha no intake");
      }
    });
  }

  async function confirmDraft(treatmentId: string) {
    setConfirming(true);
    setError(null);
    try {
      await api.confirm(treatmentId);
      setIntake(null);
      setText("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao confirmar");
    } finally {
      setConfirming(false);
    }
  }

  function simulateWhatsApp() {
    setError(null);
    startTransition(async () => {
      try {
        await api.whatsapp(phone || whatsPhone || "5511999999999", text);
        setIntake(null);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha no WhatsApp");
      }
    });
  }

  async function magicLink() {
    if (!supabase) {
      setAuthInfo("Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para Auth.");
      return;
    }
    const { error: authError } = await supabase.auth.signInWithOtp({ email: authEmail });
    setAuthInfo(authError ? authError.message : "Magic link enviado (verifique o e-mail).");
  }

  return (
    <div className="app-shell">
      <header className="fade-up" style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <div className="display" style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--bg-deep)" }}>
          DoseCerta
        </div>
        <p style={{ margin: 0, textAlign: "right", fontSize: 14, color: "var(--ink-soft)" }}>
          Electron + React · FastAPI · Supabase ({store})
        </p>
      </header>

      <section className="hero fade-up">
        <div style={{ display: "grid", gap: 20 }}>
          <p className="display" style={{ margin: 0, fontSize: "clamp(2.6rem, 6vw, 3.8rem)", color: "var(--bg-deep)" }}>
            DoseCerta
          </p>
          <h1 style={{ margin: 0, fontSize: "clamp(1.15rem, 2vw, 1.45rem)", fontWeight: 500, color: "var(--ink-soft)", maxWidth: 540 }}>
            Descreva o tratamento em linguagem natural. A IA monta as doses e o desktop
            avisa no WhatsApp até a data final.
          </h1>

          <label style={{ fontSize: 14, color: "var(--ink-soft)" }}>
            Seu tratamento
            <textarea
              className="textarea"
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='Ex.: "Amoxicilina 500mg de 8/8h por 7 dias, primeira às 14h, avisa 15 min antes."'
              style={{ marginTop: 8 }}
            />
          </label>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <input
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="WhatsApp (opcional)"
            />
            <button className="btn btn-primary" disabled={pending || text.trim().length < 3} onClick={submitIntake}>
              {pending ? "Montando…" : "Montar no app"}
            </button>
            <button className="btn btn-secondary" disabled={pending || text.trim().length < 3} onClick={simulateWhatsApp}>
              Enviar via WhatsApp
            </button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {EXAMPLES.map((example) => (
              <button key={example} className="chip" type="button" onClick={() => setText(example)}>
                {example.slice(0, 42)}…
              </button>
            ))}
          </div>
          {error ? <p style={{ color: "#9b1c1c", margin: 0 }}>{error}</p> : null}
        </div>

        <div className="fade-up-delay" style={{ position: "relative" }}>
          <div className="pulse-soft" style={{ position: "absolute", left: -24, top: 24, width: 112, height: 112, borderRadius: "50%", background: "rgba(224,138,42,0.25)", filter: "blur(28px)" }} />
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: "2rem",
              padding: 24,
              color: "var(--foam)",
              background: "linear-gradient(160deg,#0f3b36 0%,#1a6a60 55%,#c9852d 140%)",
              boxShadow: "0 30px 80px rgba(11,46,42,0.28)",
            }}
          >
            <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.7 }}>
              Desktop shell
            </p>
            <p className="display" style={{ margin: "12px 0 0", fontSize: "1.9rem", lineHeight: 1.15 }}>
              Electron pronto para multiplataforma
            </p>
            <p style={{ marginTop: 12, opacity: 0.9, fontSize: 14, lineHeight: 1.5 }}>
              O renderer React fala com o FastAPI. Persistência em Supabase Postgres
              (ou memória local no MVP sem credenciais).
            </p>
            <div style={{ marginTop: 20, padding: 14, borderRadius: 16, background: "rgba(0,0,0,0.15)", fontSize: 14 }}>
              Auth Supabase
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input
                  className="input"
                  style={{ maxWidth: "none", flex: 1, background: "rgba(255,255,255,0.9)" }}
                  placeholder="email@exemplo.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                />
                <button className="btn btn-accent" style={{ width: "auto" }} type="button" onClick={magicLink}>
                  Entrar
                </button>
              </div>
              {authInfo ? <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.85 }}>{authInfo}</p> : null}
            </div>
          </div>
        </div>
      </section>

      {intake ? (
        <section className="panel fade-up">
          <h2 className="display" style={{ margin: 0, color: "var(--bg-deep)" }}>
            Revisão da IA
          </h2>
          {intake.status === "needs_clarification" ? (
            <p style={{ color: "var(--warn)" }}>{intake.question}</p>
          ) : (
            <div className="grid-2" style={{ marginTop: 16 }}>
              <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: 0, fontSize: 14 }}>
                <div>
                  <dt style={{ color: "var(--ink-soft)" }}>Remédio</dt>
                  <dd style={{ margin: 0, fontWeight: 700 }}>
                    {intake.draft.medicationName}
                    {intake.draft.dosage ? ` · ${intake.draft.dosage}` : ""}
                  </dd>
                </div>
                <div>
                  <dt style={{ color: "var(--ink-soft)" }}>Frequência</dt>
                  <dd style={{ margin: 0, fontWeight: 700 }}>
                    {intake.draft.frequencyEveryHours
                      ? `a cada ${intake.draft.frequencyEveryHours}h`
                      : `${intake.draft.timesPerDay}x ao dia`}
                  </dd>
                </div>
                <div>
                  <dt style={{ color: "var(--ink-soft)" }}>Primeira dose</dt>
                  <dd style={{ margin: 0, fontWeight: 700 }}>{formatWhen(intake.draft.firstDoseAt)}</dd>
                </div>
                <div>
                  <dt style={{ color: "var(--ink-soft)" }}>Fim</dt>
                  <dd style={{ margin: 0, fontWeight: 700 }}>{formatWhen(intake.draft.endsAt)}</dd>
                </div>
              </dl>
              <div>
                <button className="btn btn-accent" disabled={confirming} onClick={() => confirmDraft(intake.draftId)}>
                  {confirming ? "Ativando…" : "Confirmar e ativar alertas"}
                </button>
              </div>
            </div>
          )}
        </section>
      ) : null}

      <section className="grid-2">
        <div className="panel">
          <h2 className="display" style={{ marginTop: 0, color: "var(--bg-deep)" }}>
            Tratamentos
          </h2>
          <div style={{ display: "grid", gap: 10 }}>
            {treatments.length === 0 ? (
              <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>Nenhum tratamento ainda.</p>
            ) : (
              treatments.map((treatment) => (
                <article key={treatment.id} className="panel" style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <strong>
                      {treatment.medication_name}
                      {treatment.dosage ? ` · ${treatment.dosage}` : ""}
                    </strong>
                    <span className="status-pill">{treatment.status}</span>
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--ink-soft)" }}>
                    {formatWhen(treatment.first_dose_at)} → {formatWhen(treatment.ends_at)} ·{" "}
                    {treatment.dose_count} doses
                  </p>
                  {treatment.status === "draft" ? (
                    <button
                      className="btn btn-secondary"
                      style={{ marginTop: 10 }}
                      onClick={() => confirmDraft(treatment.id)}
                    >
                      Confirmar rascunho
                    </button>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </div>

        <div className="panel">
          <h2 className="display" style={{ marginTop: 0, color: "var(--bg-deep)" }}>
            WhatsApp (log)
          </h2>
          <p style={{ marginTop: 0, fontSize: 12, color: "var(--ink-soft)" }}>Número: {whatsPhone || "—"}</p>
          <div style={{ display: "grid", gap: 8, maxHeight: 420, overflow: "auto" }}>
            {messages.map((message) => (
              <div key={message.id} className={message.direction === "outbound" ? "msg-out" : "msg-in"}>
                <div style={{ fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase", opacity: 0.7 }}>
                  {message.direction} · {formatWhen(message.created_at)}
                </div>
                <div style={{ whiteSpace: "pre-wrap", marginTop: 4, fontSize: 14 }}>{message.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
