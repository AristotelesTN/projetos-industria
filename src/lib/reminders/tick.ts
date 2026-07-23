import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp/provider";

function formatReminder(input: {
  medicationName: string;
  dosage: string | null;
  scheduledAt: Date;
  remindBeforeMinutes: number;
  endsAt: Date;
}) {
  const when = input.scheduledAt.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const daysLeft = Math.max(
    0,
    Math.ceil((input.endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );
  const dose = input.dosage ? ` (${input.dosage})` : "";
  return [
    `Lembrete DoseCerta: em breve (por volta de ${when}) tome ${input.medicationName}${dose}.`,
    `Aviso com ${input.remindBeforeMinutes} min de antecedência.`,
    `Restam cerca de ${daysLeft} dia(s) de tratamento.`,
    "Responda TOMEI ou ADIAR.",
  ].join("\n");
}

export async function processDueReminders(now = new Date()) {
  const due = await prisma.dose.findMany({
    where: {
      status: "pending",
      remindAt: { lte: now },
      treatment: { status: "active" },
    },
    include: {
      treatment: {
        include: { user: true },
      },
    },
    take: 50,
    orderBy: { remindAt: "asc" },
  });

  const results: Array<{ doseId: string; ok: boolean; error?: string }> = [];

  for (const dose of due) {
    const body = formatReminder({
      medicationName: dose.treatment.medicationName,
      dosage: dose.treatment.dosage,
      scheduledAt: dose.scheduledAt,
      remindBeforeMinutes: dose.treatment.remindBeforeMinutes,
      endsAt: dose.treatment.endsAt,
    });

    const sent = await sendWhatsApp(dose.treatment.user.phone, body);
    if (sent.ok) {
      await prisma.dose.update({
        where: { id: dose.id },
        data: { status: "reminded", remindedAt: now },
      });
      results.push({ doseId: dose.id, ok: true });
    } else {
      results.push({ doseId: dose.id, ok: false, error: sent.error });
    }
  }

  await completeFinishedTreatments(now);
  return { processed: results.length, results };
}

async function completeFinishedTreatments(now: Date) {
  const active = await prisma.treatment.findMany({
    where: { status: "active", endsAt: { lte: now } },
    include: { user: true, doses: true },
  });

  for (const treatment of active) {
    const pending = treatment.doses.some(
      (d: { status: string }) => ["pending", "reminded"].includes(d.status),
    );
    if (pending && treatment.endsAt > now) continue;

    const allDone = treatment.doses.every((d: { status: string }) =>
      ["taken", "skipped"].includes(d.status),
    );
    const pastEnd = treatment.endsAt <= now;

    if (allDone || pastEnd) {
      await prisma.treatment.update({
        where: { id: treatment.id },
        data: { status: "completed" },
      });
      await sendWhatsApp(
        treatment.user.phone,
        `Tratamento de ${treatment.medicationName} concluído. Cuide-se!`,
      );
    }
  }
}
