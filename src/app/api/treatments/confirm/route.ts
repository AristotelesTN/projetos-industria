import { NextResponse } from "next/server";
import { z } from "zod";
import { confirmTreatment } from "@/lib/intake/service";
import { prisma } from "@/lib/prisma";

const BodySchema = z.object({
  treatmentId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = BodySchema.parse(await request.json());
    const treatment = await confirmTreatment(body.treatmentId);
    const doses = await prisma.dose.count({ where: { treatmentId: treatment.id } });
    return NextResponse.json({ treatment, doses });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao confirmar";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
