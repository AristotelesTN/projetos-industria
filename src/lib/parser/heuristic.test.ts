import { describe, expect, it } from "vitest";
import { parseHeuristic } from "@/lib/parser/heuristic";
import { buildDosePlan } from "@/lib/schedule/doses";

describe("parseHeuristic", () => {
  it("extrai antibiótico 8/8h com duração", () => {
    const now = new Date("2026-07-23T10:00:00-03:00");
    const parsed = parseHeuristic(
      "Amoxicilina 500mg de 8 em 8 horas por 7 dias, começando hoje às 14h. Me avisa 15 minutos antes.",
      { now, timezone: "America/Sao_Paulo" },
    );

    expect(parsed.medicationName.toLowerCase()).toContain("amoxicilina");
    expect(parsed.dosage?.toLowerCase()).toContain("500");
    expect(parsed.frequencyEveryHours).toBe(8);
    expect(parsed.remindBeforeMinutes).toBe(15);
    expect(parsed.missingFields).toEqual([]);
    expect(parsed.confidence).toBeGreaterThan(0.5);
    expect(new Date(parsed.firstDoseAt).toISOString()).toBe("2026-07-23T17:00:00.000Z");

    const plan = buildDosePlan(parsed);
    expect(plan.length).toBeGreaterThan(10);
    expect(plan[0]?.remindAt.getTime()).toBeLessThan(plan[0]!.scheduledAt.getTime());
  });

  it("pede duração quando falta data fim", () => {
    const parsed = parseHeuristic("Dipirona 500mg de 6 em 6 horas começando agora", {
      now: new Date("2026-07-23T10:00:00-03:00"),
      timezone: "America/Sao_Paulo",
    });
    expect(parsed.missingFields).toContain("endsAt");
    expect(parsed.clarifyingQuestion).toMatch(/dias/i);
  });
});
