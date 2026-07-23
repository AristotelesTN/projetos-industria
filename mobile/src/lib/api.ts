import { Platform } from "react-native";
import Constants from "expo-constants";

function resolveApiBase(): string {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL.replace(/\/$/, "");
  }

  // Android emulator reaches host machine via 10.0.2.2
  if (Platform.OS === "android") {
    return "http://10.0.2.2:8000/api";
  }

  // Expo Go on a physical device: try hostUri from Metro
  const expoConstants = Constants as typeof Constants & {
    manifest2?: { extra?: { expoClient?: { hostUri?: string } } };
    manifest?: { debuggerHost?: string };
  };
  const hostUri =
    Constants.expoConfig?.hostUri ||
    expoConstants.manifest2?.extra?.expoClient?.hostUri ||
    expoConstants.manifest?.debuggerHost;

  if (typeof hostUri === "string" && hostUri.includes(":")) {
    const host = hostUri.split(":")[0];
    if (host && host !== "127.0.0.1" && host !== "localhost") {
      return `http://${host}:8000/api`;
    }
  }

  return "http://127.0.0.1:8000/api";
}

const API_BASE = resolveApiBase();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = (data as { detail?: string; error?: string }).detail
      || (data as { error?: string }).error
      || `Falha na API (${response.status})`;
    throw new Error(detail);
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
};

export type Message = {
  id: string;
  direction: string;
  body: string;
  created_at: string;
};

export const api = {
  baseUrl: API_BASE,
  health: () => request<{ ok: boolean; store: string }>("/health"),
  intake: (text: string, phone?: string) =>
    request<IntakeResponse>("/intake", {
      method: "POST",
      body: JSON.stringify({ text, phone }),
    }),
  confirm: (treatmentId: string) =>
    request<{ doses: number }>("/treatments/confirm", {
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
