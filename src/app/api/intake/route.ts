import { NextResponse } from "next/server";
import { z } from "zod";
import { runIntake } from "@/lib/intake/service";

const BodySchema = z.object({
  text: z.string().min(3),
  phone: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const body = BodySchema.parse(json);
    const result = await runIntake(body.text, { phone: body.phone });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro no intake";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
