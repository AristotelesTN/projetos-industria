"use client";

import { useEffect, useState, useTransition } from "react";

type IntakeResponse =
  | {
      status: "needs_clarification";
      question: string;
      partial: {
        medicationName?: string;
        sourceText: string;
        assumptions?: string[];
      };
    }
  | {
      status: "ready_for_confirm";
      draftId: string;
      draft: {
        medicationName: string;
        dosage: string | null;
        frequencyEveryHours: number | null;
        timesPerDay: number | null;
        firstDoseAt: string;
        endsAt: string;
        remindBeforeMinutes: number;
        assumptions: string[];
        estimatedDoses: number;
        sourceText: string;
      };
    };

type Treatment = {
  id: string;
  medicationName: string;
  dosage: string | null;
  status: string;
  firstDoseAt: string;
  endsAt: string;
  remindBeforeMinutes: number;
  sourceText: string;
  _count: { doses: number };
  doses: Array<{
    id: string;
    scheduledAt: string;
    remindAt: string;
    status: string;
  }>;
};

type Message = {
  id: string;
  direction: string;
  body: string;
  createdAt: string;
};

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

export function IntakeApp() {
  const [text, setText] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [intake, setIntake] = useState<IntakeResponse | null>(null);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [whatsPhone, setWhatsPhone] = useState("");
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  async function refresh() {
    const [tRes, mRes] = await Promise.all([
      fetch("/api/treatments"),
      fetch("/api/messages"),
    ]);
    const tJson = await tRes.json();
    const mJson = await mRes.json();
    setTreatments(tJson.treatments ?? []);
    setMessages(mJson.messages ?? []);
    setWhatsPhone(mJson.phone ?? "");
  }

  useEffect(() => {
    void refresh();
    const id = setInterval(() => {
      void fetch("/api/scheduler/tick", { method: "POST" });
      void refresh();
    }, 30000);
    return () => clearInterval(id);
  }, []);

  function submitIntake() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, phone: phone || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Falha ao interpretar o tratamento");
        return;
      }
      setIntake(json);
      await refresh();
    });
  }

  async function confirmDraft(treatmentId: string) {
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch("/api/treatments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ treatmentId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Falha ao confirmar");
        return;
      }
      setIntake(null);
      setText("");
      await refresh();
    } finally {
      setConfirming(false);
    }
  }

  async function simulateWhatsApp() {
    if (!text.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/whatsapp/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: phone || whatsPhone || "5511999999999",
          text,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Falha no WhatsApp simulado");
        return;
      }
      setIntake(null);
      await refresh();
    });
  }

  return (
    <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-14 px-5 pb-20 pt-8 sm:px-8">
      <header className="fade-up flex items-center justify-between gap-4">
        <div className="display text-2xl font-semibold text-[var(--bg-deep)] sm:text-3xl">
          DoseCerta
        </div>
        <p className="max-w-xs text-right text-sm text-[var(--ink-soft)]">
          App + WhatsApp · tratamentos com data de fim
        </p>
      </header>

      <section className="fade-up relative grid min-h-[70vh] items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="relative z-10 space-y-6">
          <p className="display text-5xl leading-[1.05] text-[var(--bg-deep)] sm:text-6xl">
            DoseCerta
          </p>
          <h1 className="max-w-xl text-xl leading-snug text-[var(--ink-soft)] sm:text-2xl">
            Descreva o tratamento como você fala. A IA organiza doses e avisa no
            WhatsApp até o último dia.
          </h1>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-[var(--ink-soft)]" htmlFor="treatment">
              Seu tratamento
            </label>
            <textarea
              id="treatment"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder='Ex.: "Amoxicilina 500mg de 8/8h por 7 dias, primeira às 14h, avisa 15 min antes."'
              className="w-full resize-y rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-base outline-none ring-[var(--accent)] transition focus:ring-2"
            />
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="WhatsApp (opcional, só números)"
                className="w-full rounded-xl border border-[var(--line)] bg-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)] sm:max-w-xs"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={submitIntake}
                  disabled={pending || text.trim().length < 3}
                  className="rounded-xl bg-[var(--bg-deep)] px-4 py-2 text-sm font-semibold text-[var(--foam)] transition hover:bg-[var(--bg-mid)] disabled:opacity-50"
                >
                  {pending ? "Montando…" : "Montar no app"}
                </button>
                <button
                  type="button"
                  onClick={simulateWhatsApp}
                  disabled={pending || text.trim().length < 3}
                  className="rounded-xl border border-[var(--bg-deep)] px-4 py-2 text-sm font-semibold text-[var(--bg-deep)] transition hover:bg-white/70 disabled:opacity-50"
                >
                  Enviar via WhatsApp
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setText(example)}
                  className="rounded-full border border-[var(--line)] bg-white/50 px-3 py-1 text-left text-xs text-[var(--ink-soft)] transition hover:border-[var(--accent)]"
                >
                  {example.slice(0, 42)}…
                </button>
              ))}
            </div>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
          </div>
        </div>

        <div className="fade-up-delay relative">
          <div className="pulse-soft absolute -left-6 top-8 h-28 w-28 rounded-full bg-[var(--accent)]/25 blur-2xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-white/40 bg-[linear-gradient(160deg,#0f3b36_0%,#1a6a60_55%,#c9852d_140%)] p-6 text-[var(--foam)] shadow-[0_30px_80px_rgba(11,46,42,0.28)]">
            <p className="text-xs uppercase tracking-[0.2em] text-white/70">Canal vivo</p>
            <p className="display mt-3 text-3xl leading-tight">WhatsApp com antecedência</p>
            <p className="mt-3 text-sm leading-relaxed text-white/85">
              Confirme o rascunho e a DoseCerta dispara avisos antes de cada dose
              até a data final do tratamento.
            </p>
            <div className="mt-6 space-y-2 rounded-2xl bg-black/15 p-4 text-sm">
              <p className="font-medium">Exemplo de aviso</p>
              <p className="text-white/85">
                Em breve (14:00) tome Amoxicilina (500mg). Responda TOMEI ou ADIAR.
              </p>
            </div>
          </div>
        </div>
      </section>

      {intake ? (
        <section className="fade-up rounded-3xl border border-[var(--line)] bg-white/75 p-6 shadow-sm backdrop-blur">
          <h2 className="display text-2xl text-[var(--bg-deep)]">Revisão da IA</h2>
          {intake.status === "needs_clarification" ? (
            <div className="mt-4 space-y-2">
              <p className="text-[var(--warn)]">{intake.question}</p>
              <p className="text-sm text-[var(--ink-soft)]">
                Responda na caixa acima (app) ou no WhatsApp com o detalhe que falta.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[var(--ink-soft)]">Remédio</dt>
                  <dd className="font-semibold">
                    {intake.draft.medicationName}
                    {intake.draft.dosage ? ` · ${intake.draft.dosage}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--ink-soft)]">Frequência</dt>
                  <dd className="font-semibold">
                    {intake.draft.frequencyEveryHours
                      ? `a cada ${intake.draft.frequencyEveryHours}h`
                      : `${intake.draft.timesPerDay}x ao dia`}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--ink-soft)]">Primeira dose</dt>
                  <dd className="font-semibold">{formatWhen(intake.draft.firstDoseAt)}</dd>
                </div>
                <div>
                  <dt className="text-[var(--ink-soft)]">Fim</dt>
                  <dd className="font-semibold">{formatWhen(intake.draft.endsAt)}</dd>
                </div>
                <div>
                  <dt className="text-[var(--ink-soft)]">Antecedência</dt>
                  <dd className="font-semibold">{intake.draft.remindBeforeMinutes} min</dd>
                </div>
                <div>
                  <dt className="text-[var(--ink-soft)]">Doses</dt>
                  <dd className="font-semibold">{intake.draft.estimatedDoses}</dd>
                </div>
              </dl>
              <div className="space-y-3">
                {intake.draft.assumptions?.length ? (
                  <p className="text-sm text-[var(--ink-soft)]">
                    Premissas: {intake.draft.assumptions.join("; ")}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={confirming}
                  onClick={() => confirmDraft(intake.draftId)}
                  className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-bold text-[var(--bg-deep)] transition hover:bg-[var(--accent-deep)] hover:text-white disabled:opacity-50"
                >
                  {confirming ? "Ativando…" : "Confirmar e ativar alertas"}
                </button>
              </div>
            </div>
          )}
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-[var(--line)] bg-white/70 p-6">
          <h2 className="display text-2xl text-[var(--bg-deep)]">Tratamentos</h2>
          <div className="mt-4 space-y-3">
            {treatments.length === 0 ? (
              <p className="text-sm text-[var(--ink-soft)]">Nenhum tratamento ainda.</p>
            ) : (
              treatments.map((treatment) => (
                <article
                  key={treatment.id}
                  className="rounded-2xl border border-[var(--line)] bg-[var(--foam)]/80 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {treatment.medicationName}
                        {treatment.dosage ? ` · ${treatment.dosage}` : ""}
                      </p>
                      <p className="text-xs text-[var(--ink-soft)]">
                        {formatWhen(treatment.firstDoseAt)} → {formatWhen(treatment.endsAt)}
                      </p>
                    </div>
                    <span className="rounded-full bg-[var(--bg-deep)]/10 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-[var(--bg-deep)]">
                      {treatment.status}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-[var(--ink-soft)]">
                    “{treatment.sourceText}”
                  </p>
                  <p className="mt-2 text-xs text-[var(--ink-soft)]">
                    {treatment._count.doses} doses · aviso {treatment.remindBeforeMinutes} min
                  </p>
                  {treatment.status === "draft" ? (
                    <button
                      type="button"
                      onClick={() => confirmDraft(treatment.id)}
                      className="mt-3 text-sm font-semibold text-[var(--accent-deep)]"
                    >
                      Confirmar rascunho
                    </button>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--line)] bg-white/70 p-6">
          <h2 className="display text-2xl text-[var(--bg-deep)]">WhatsApp (log)</h2>
          <p className="mt-1 text-xs text-[var(--ink-soft)]">
            Número padrão: {whatsPhone || "—"} · provider mock grava aqui
          </p>
          <div className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
            {messages.length === 0 ? (
              <p className="text-sm text-[var(--ink-soft)]">Sem mensagens ainda.</p>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-2xl px-3 py-2 text-sm ${
                    message.direction === "outbound"
                      ? "bg-[var(--bg-deep)] text-[var(--foam)]"
                      : "bg-white border border-[var(--line)]"
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-wide opacity-70">
                    {message.direction} · {formatWhen(message.createdAt)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
