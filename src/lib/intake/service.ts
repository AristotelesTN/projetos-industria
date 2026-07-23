import { prisma } from "@/lib/prisma";
import { parseTreatmentText } from "@/lib/parser/ai";
import { buildDosePlan, estimateDoseCount } from "@/lib/schedule/doses";
import type { IntakeResult, ParsedTreatment } from "@/lib/types";
import { getDefaultUser, getOrCreateUser, normalizePhone } from "@/lib/users";

export async function runIntake(
  text: string,
  options: { phone?: string; timezone?: string } = {},
): Promise<IntakeResult & { draftId?: string }> {
  const user = options.phone
    ? await getOrCreateUser(options.phone)
    : await getDefaultUser();

  const timezone = options.timezone ?? user.timezone;
  const parsed = await parseTreatmentText(text, { timezone });

  if (
    parsed.missingFields.length > 0 ||
    parsed.clarifyingQuestion ||
    parsed.confidence < 0.55
  ) {
    const question =
      parsed.clarifyingQuestion ??
      "Pode detalhar frequência, horário da primeira dose e duração em dias?";

    await prisma.chatSession.upsert({
      where: { phone: user.phone },
      create: {
        userId: user.id,
        phone: user.phone,
        state: "awaiting_clarification",
        draftJson: JSON.stringify({ sourceText: text, partial: parsed }),
      },
      update: {
        state: "awaiting_clarification",
        draftJson: JSON.stringify({ sourceText: text, partial: parsed }),
      },
    });

    return {
      status: "needs_clarification",
      question,
      partial: { ...parsed, sourceText: text },
    };
  }

  const estimatedDoses = estimateDoseCount(parsed);
  const draft = {
    ...parsed,
    sourceText: text,
    estimatedDoses,
  };

  const treatment = await prisma.treatment.create({
    data: {
      userId: user.id,
      medicationName: parsed.medicationName,
      dosage: parsed.dosage,
      frequencyEveryHours: parsed.frequencyEveryHours,
      timesPerDay: parsed.timesPerDay,
      anchorTimesJson: JSON.stringify(parsed.anchorTimes),
      firstDoseAt: new Date(parsed.firstDoseAt),
      endsAt: new Date(parsed.endsAt),
      remindBeforeMinutes: parsed.remindBeforeMinutes,
      notes: parsed.notes,
      sourceText: text,
      parsedJson: JSON.stringify(parsed),
      status: "draft",
    },
  });

  await prisma.chatSession.upsert({
    where: { phone: user.phone },
    create: {
      userId: user.id,
      phone: user.phone,
      state: "awaiting_confirm",
      draftJson: JSON.stringify({ treatmentId: treatment.id, draft }),
    },
    update: {
      state: "awaiting_confirm",
      draftJson: JSON.stringify({ treatmentId: treatment.id, draft }),
    },
  });

  return {
    status: "ready_for_confirm",
    draft,
    draftId: treatment.id,
  };
}

export async function confirmTreatment(treatmentId: string) {
  const treatment = await prisma.treatment.findUnique({ where: { id: treatmentId } });
  if (!treatment) throw new Error("Tratamento não encontrado");
  if (treatment.status === "active") return treatment;

  const parsed = JSON.parse(treatment.parsedJson) as ParsedTreatment;
  const plan = buildDosePlan(parsed);

  await prisma.dose.deleteMany({ where: { treatmentId } });
  await prisma.dose.createMany({
    data: plan.map((dose) => ({
      treatmentId,
      scheduledAt: dose.scheduledAt,
      remindAt: dose.remindAt,
      status: "pending",
    })),
  });

  const updated = await prisma.treatment.update({
    where: { id: treatmentId },
    data: { status: "active" },
  });

  await prisma.chatSession.updateMany({
    where: { userId: treatment.userId },
    data: { state: "idle", draftJson: null },
  });

  return updated;
}

export async function cancelDraft(treatmentId: string) {
  return prisma.treatment.update({
    where: { id: treatmentId },
    data: { status: "cancelled" },
  });
}

export function formatDraftSummary(
  draft: ParsedTreatment & { estimatedDoses?: number },
): string {
  const freq = draft.frequencyEveryHours
    ? `a cada ${draft.frequencyEveryHours}h`
    : draft.timesPerDay
      ? `${draft.timesPerDay}x ao dia`
      : "frequência a confirmar";

  const lines = [
    `*${draft.medicationName}*${draft.dosage ? ` (${draft.dosage})` : ""}`,
    `Frequência: ${freq}`,
    `Primeira dose: ${new Date(draft.firstDoseAt).toLocaleString("pt-BR")}`,
    `Fim: ${new Date(draft.endsAt).toLocaleString("pt-BR")}`,
    `Aviso: ${draft.remindBeforeMinutes} min antes`,
  ];

  if (draft.estimatedDoses) {
    lines.push(`Doses previstas: ${draft.estimatedDoses}`);
  }
  if (draft.assumptions.length) {
    lines.push(`Premissas: ${draft.assumptions.join("; ")}`);
  }
  lines.push("Responda CONFIRMAR para ativar ou CANCELar.");
  return lines.join("\n");
}

export async function handleInboundChat(phone: string, body: string) {
  const user = await getOrCreateUser(phone);
  const text = body.trim();
  const lower = text.toLowerCase();

  const session = await prisma.chatSession.findUnique({ where: { phone: user.phone } });

  if (["confirmar", "confirm", "ok", "sim"].includes(lower)) {
    if (session?.state === "awaiting_confirm" && session.draftJson) {
      const data = JSON.parse(session.draftJson) as { treatmentId: string };
      await confirmTreatment(data.treatmentId);
      return "Tratamento ativado. Vou te avisar no WhatsApp antes de cada dose até o fim.";
    }
    return "Não há rascunho aguardando confirmação. Descreva o tratamento.";
  }

  if (["cancelar", "cancel", "nao", "não"].includes(lower)) {
    if (session?.draftJson) {
      try {
        const data = JSON.parse(session.draftJson) as { treatmentId?: string };
        if (data.treatmentId) await cancelDraft(data.treatmentId);
      } catch {
        /* ignore */
      }
    }
    await prisma.chatSession.upsert({
      where: { phone: user.phone },
      create: { userId: user.id, phone: user.phone, state: "idle", draftJson: null },
      update: { state: "idle", draftJson: null },
    });
    return "Rascunho cancelado. Pode descrever outro tratamento quando quiser.";
  }

  if (["tomei", "1"].includes(lower)) {
    const dose = await prisma.dose.findFirst({
      where: {
        status: { in: ["reminded", "pending"] },
        treatment: { userId: user.id, status: "active" },
      },
      orderBy: { scheduledAt: "asc" },
    });
    if (!dose) return "Não encontrei dose pendente para marcar.";
    await prisma.dose.update({
      where: { id: dose.id },
      data: { status: "taken", takenAt: new Date() },
    });
    return "Anotado: dose tomada. Bom tratamento!";
  }

  if (["adiar", "2"].includes(lower)) {
    const dose = await prisma.dose.findFirst({
      where: {
        status: { in: ["reminded", "pending"] },
        treatment: { userId: user.id, status: "active" },
      },
      orderBy: { scheduledAt: "asc" },
    });
    if (!dose) return "Não encontrei dose para adiar.";
    const snoozeUntil = new Date(Date.now() + 15 * 60 * 1000);
    await prisma.dose.update({
      where: { id: dose.id },
      data: {
        status: "pending",
        remindAt: snoozeUntil,
        snoozeCount: { increment: 1 },
      },
    });
    return "Ok, te lembro de novo em 15 minutos.";
  }

  let intakeText = text;
  if (session?.state === "awaiting_clarification" && session.draftJson) {
    try {
      const prev = JSON.parse(session.draftJson) as { sourceText?: string };
      if (prev.sourceText) {
        intakeText = `${prev.sourceText}\n${text}`;
      }
    } catch {
      /* ignore */
    }
  }

  const result = await runIntake(intakeText, { phone: normalizePhone(phone) });
  if (result.status === "needs_clarification") {
    return `Entendi parcialmente. ${result.question}`;
  }

  return `Montei o tratamento:\n\n${formatDraftSummary(result.draft)}`;
}
