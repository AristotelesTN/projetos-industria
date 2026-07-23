import { z } from "zod";

export const ParsedTreatmentSchema = z.object({
  medicationName: z.string().min(1),
  dosage: z.string().nullable(),
  frequencyEveryHours: z.number().int().positive().nullable(),
  timesPerDay: z.number().int().positive().nullable(),
  anchorTimes: z.array(z.string().regex(/^\d{2}:\d{2}$/)).default([]),
  firstDoseAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  remindBeforeMinutes: z.number().int().min(0).max(180).default(15),
  notes: z.string().nullable(),
  missingFields: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  clarifyingQuestion: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export type ParsedTreatment = z.infer<typeof ParsedTreatmentSchema>;

export type IntakeResult =
  | {
      status: "needs_clarification";
      question: string;
      partial: Partial<ParsedTreatment> & { sourceText: string };
    }
  | {
      status: "ready_for_confirm";
      draft: ParsedTreatment & { sourceText: string; estimatedDoses: number };
    };

export type ChatState = "idle" | "awaiting_clarification" | "awaiting_confirm";
