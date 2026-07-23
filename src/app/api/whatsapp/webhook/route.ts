import { NextResponse } from "next/server";
import { handleInboundChat } from "@/lib/intake/service";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp/provider";
import { normalizePhone } from "@/lib/users";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN ?? "dosecerta-verify";

  if (mode === "subscribe" && token === verifyToken) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

type MetaWebhook = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from: string;
          text?: { body?: string };
          type?: string;
        }>;
      };
    }>;
  }>;
};

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  // Local/dev helper: { "from": "5511...", "text": "..." }
  if (contentType.includes("application/json")) {
    const payload = await request.json();

    if (payload?.from && payload?.text) {
      const phone = normalizePhone(String(payload.from));
      const text = String(payload.text);
      await prisma.messageLog.create({
        data: { phone, direction: "inbound", body: text },
      });
      const reply = await handleInboundChat(phone, text);
      await sendWhatsApp(phone, reply);
      return NextResponse.json({ reply });
    }

    const meta = payload as MetaWebhook;
    const messages =
      meta.entry?.flatMap((e) => e.changes ?? []).flatMap((c) => c.value?.messages ?? []) ??
      [];

    const replies: string[] = [];
    for (const message of messages) {
      if (!message.text?.body) continue;
      const phone = normalizePhone(message.from);
      await prisma.messageLog.create({
        data: { phone, direction: "inbound", body: message.text.body },
      });
      const reply = await handleInboundChat(phone, message.text.body);
      await sendWhatsApp(phone, reply);
      replies.push(reply);
    }

    return NextResponse.json({ ok: true, replies });
  }

  return NextResponse.json({ ok: true });
}
