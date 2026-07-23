const API_BASE =
  window.dosecerta?.apiBaseUrl ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.error || "Falha na API");
  }
  return data as T;
}

export type IntakeResponse =
  | {
      status: "needs_clarification";
      question: string;
      partial: Record<string, unknown>;
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

export type Treatment = {
  id: string;
  medication_name: string;
  dosage: string | null;
  status: string;
  first_dose_at: string;
  ends_at: string;
  remind_before_minutes: number;
  source_text: string;
  dose_count: number;
  doses: Array<{
    id: string;
    scheduled_at: string;
    remind_at: string;
    status: string;
  }>;
};

export type Message = {
  id: string;
  direction: string;
  body: string;
  created_at: string;
};

export const api = {
  health: () => request<{ ok: boolean; store: string }>("/health"),
  intake: (text: string, phone?: string) =>
    request<IntakeResponse>("/intake", {
      method: "POST",
      body: JSON.stringify({ text, phone }),
    }),
  confirm: (treatmentId: string) =>
    request<{ treatment: Treatment; doses: number }>("/treatments/confirm", {
      method: "POST",
      body: JSON.stringify({ treatmentId }),
    }),
  treatments: (phone?: string) =>
    request<{ treatments: Treatment[] }>(
      `/treatments${phone ? `?phone=${encodeURIComponent(phone)}` : ""}`,
    ),
  messages: (phone?: string) =>
    request<{ phone: string; messages: Message[] }>(
      `/messages${phone ? `?phone=${encodeURIComponent(phone)}` : ""}`,
    ),
  tick: () => request<{ processed: number }>("/scheduler/tick", { method: "POST" }),
  whatsapp: (from: string, text: string) =>
    request<{ reply: string }>("/whatsapp/webhook", {
      method: "POST",
      body: JSON.stringify({ from, text }),
    }),
};
