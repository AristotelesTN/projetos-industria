import OpenAI from "openai";
import { ParsedTreatmentSchema, type ParsedTreatment } from "@/lib/types";
import { parseHeuristic } from "@/lib/parser/heuristic";
import { formatInTimeZone } from "date-fns-tz";

const SYSTEM_PROMPT = `Você extrai tratamentos medicamentosos a partir de texto em português do Brasil.
Regras:
- Sempre exija data/hora de fim do tratamento (endsAt). Tratamentos contínuos não são permitidos no MVP.
- Não invente duração nem horário se não estiver claro; use missingFields e clarifyingQuestion.
- firstDoseAt e endsAt devem ser ISO-8601 com offset.
- frequencyEveryHours OU timesPerDay+anchorTimes.
- remindBeforeMinutes padrão 15 se omitido (registre em assumptions).
- Responda APENAS JSON válido no schema pedido.`;

export async function parseTreatmentText(
  text: string,
  options: { now?: Date; timezone?: string } = {},
): Promise<ParsedTreatment> {
  const timezone = options.timezone ?? process.env.DEFAULT_TIMEZONE ?? "America/Sao_Paulo";
  const now = options.now ?? new Date();
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return parseHeuristic(text, { now, timezone });
  }

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const nowLocal = formatInTimeZone(now, timezone, "yyyy-MM-dd'T'HH:mm:ssXXX");

  const response = await client.chat.completions.create({
    model,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          now: nowLocal,
          timezone,
          text,
          schema: {
            medicationName: "string",
            dosage: "string|null",
            frequencyEveryHours: "number|null",
            timesPerDay: "number|null",
            anchorTimes: ["HH:mm"],
            firstDoseAt: "ISO datetime with offset",
            endsAt: "ISO datetime with offset",
            remindBeforeMinutes: "number",
            notes: "string|null",
            missingFields: ["string"],
            assumptions: ["string"],
            clarifyingQuestion: "string|null",
            confidence: "0..1",
          },
        }),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return parseHeuristic(text, { now, timezone });
  }

  try {
    const json = JSON.parse(content);
    return ParsedTreatmentSchema.parse(json);
  } catch {
    return parseHeuristic(text, { now, timezone });
  }
}
