import { addDays, addHours } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { ParsedTreatment } from "@/lib/types";

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function extractMedication(raw: string): string | null {
  const patterns = [
    /(?:tomar|tome|remedio|remédio|medicamento)\s+(?:de\s+)?([a-zA-ZÀ-ÿ0-9][\wÀ-ÿ\s-]{1,40}?)(?:\s+\d|\s+de\s+\d|\s+a\s+cada|,|\.|$)/i,
    /^([a-zA-ZÀ-ÿ][\wÀ-ÿ-]{2,40})(?:\s+\d{2,4}\s*mg|\s+\d+\s*comprimido)/i,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]) {
      return match[1].trim().replace(/\s+/g, " ");
    }
  }
  const first = raw.trim().split(/\s+/).slice(0, 2).join(" ");
  return first || null;
}

function extractDosage(raw: string): string | null {
  const match = raw.match(/(\d+(?:[.,]\d+)?\s*(?:mg|g|ml|comprimidos?|capsulas?|cápsulas?|gotas?))/i);
  return match?.[1]?.replace(/\s+/g, " ") ?? null;
}

function extractEveryHours(norm: string): number | null {
  const patterns = [
    /(?:de\s+)?(\d{1,2})\s*(?:em|\/)\s*\1/,
    /a\s+cada\s+(\d{1,2})\s*h(?:oras?)?/,
    /cada\s+(\d{1,2})\s*h(?:oras?)?/,
  ];
  for (const pattern of patterns) {
    const match = norm.match(pattern);
    if (match?.[1]) return Number(match[1]);
  }
  return null;
}

function extractTimesPerDay(norm: string): number | null {
  const match = norm.match(/(\d)\s*x\s*(?:ao|por)?\s*dia/);
  if (match?.[1]) return Number(match[1]);
  if (norm.includes("duas vezes") || norm.includes("2 vezes")) return 2;
  if (norm.includes("tres vezes") || norm.includes("3 vezes")) return 3;
  if (norm.includes("uma vez") || norm.includes("1 vez") || norm.includes("todo dia") || norm.includes("diariamente")) {
    return 1;
  }
  return null;
}

function extractDurationDays(norm: string): number | null {
  const match = norm.match(/(?:por|durante)\s+(\d{1,3})\s*dias?/);
  if (match?.[1]) return Number(match[1]);
  return null;
}

function extractRemindMinutes(norm: string): number {
  const match = norm.match(/(?:avisa|avise|avisar|lembra|lembre)\s*(?:me\s*)?(?:com\s*)?(\d{1,3})\s*min/);
  if (match?.[1]) return Number(match[1]);
  return 15;
}

function extractClock(norm: string): { hour: number; minute: number } | null {
  const match = norm.match(/(?:as|às|=)\s*(\d{1,2})(?::(\d{2}))?\s*h?/);
  if (!match) {
    if (norm.includes("agora")) return null;
    if (norm.includes("manha") || norm.includes("de manha")) return { hour: 8, minute: 0 };
    if (norm.includes("almoco")) return { hour: 12, minute: 0 };
    if (norm.includes("noite")) return { hour: 20, minute: 0 };
    return null;
  }
  return { hour: Number(match[1]), minute: Number(match[2] ?? "0") };
}

function atLocalTime(base: Date, hour: number, minute: number, timezone: string) {
  const datePart = formatInTimeZone(base, timezone, "yyyy-MM-dd");
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return fromZonedTime(`${datePart}T${hh}:${mm}:00`, timezone);
}

export function parseHeuristic(
  text: string,
  options: { now?: Date; timezone?: string } = {},
): ParsedTreatment {
  const timezone = options.timezone ?? "America/Sao_Paulo";
  const now = options.now ?? new Date();
  const raw = text.trim();
  const norm = normalize(raw);

  const medicationName = extractMedication(raw);
  const dosage = extractDosage(raw);
  const everyHours = extractEveryHours(norm);
  const timesPerDay = everyHours ? null : extractTimesPerDay(norm);
  const durationDays = extractDurationDays(norm);
  const remindBeforeMinutes = extractRemindMinutes(norm);
  const clock = extractClock(norm);

  const missingFields: string[] = [];
  const assumptions: string[] = [];

  if (!medicationName) missingFields.push("medicationName");
  if (!everyHours && !timesPerDay) missingFields.push("frequency");
  if (!durationDays) missingFields.push("endsAt");

  let firstDoseAt: Date;
  if (norm.includes("amanha")) {
    const tomorrow = addDays(now, 1);
    const hour = clock?.hour ?? 8;
    const minute = clock?.minute ?? 0;
    firstDoseAt = atLocalTime(tomorrow, hour, minute, timezone);
    if (!clock) assumptions.push("Horário da manhã assumido como 08:00");
  } else if (clock) {
    firstDoseAt = atLocalTime(now, clock.hour, clock.minute, timezone);
    if (firstDoseAt < now) {
      firstDoseAt = atLocalTime(addDays(now, 1), clock.hour, clock.minute, timezone);
      assumptions.push("Horário de hoje já passou; primeira dose amanhã no mesmo horário");
    }
  } else if (norm.includes("agora")) {
    firstDoseAt = now;
  } else {
    firstDoseAt = addHours(now, 1);
    assumptions.push("Primeira dose assumida para daqui a 1 hora");
    missingFields.push("firstDoseAt");
  }

  let endsAt: Date | null = null;
  if (durationDays) {
    endsAt = addDays(firstDoseAt, durationDays);
  }

  if (!endsAt) {
    missingFields.push("endsAt");
  }

  const clarifyingQuestion =
    missingFields.length > 0
      ? missingFields.includes("endsAt")
        ? "Por quantos dias dura o tratamento? (MVP exige data de fim.)"
        : missingFields.includes("frequency")
          ? "De quanto em quanto tempo você toma? Ex.: de 8 em 8 horas."
          : missingFields.includes("medicationName")
            ? "Qual é o nome do remédio?"
            : "Pode completar horário da primeira dose e duração em dias?"
      : null;

  const hh = formatInTimeZone(firstDoseAt, timezone, "HH:mm");

  return {
    medicationName: medicationName ?? "Remédio",
    dosage,
    frequencyEveryHours: everyHours,
    timesPerDay,
    anchorTimes: everyHours ? [] : [hh],
    firstDoseAt: firstDoseAt.toISOString(),
    endsAt: (endsAt ?? addDays(firstDoseAt, 1)).toISOString(),
    remindBeforeMinutes,
    notes: null,
    missingFields: [...new Set(missingFields)],
    assumptions,
    clarifyingQuestion,
    confidence: missingFields.length === 0 ? 0.75 : 0.35,
  };
}
