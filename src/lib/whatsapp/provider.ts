import { prisma } from "@/lib/prisma";

export type WhatsAppSendResult = {
  ok: boolean;
  provider: string;
  id?: string;
  error?: string;
};

export interface WhatsAppProvider {
  name: string;
  sendText(phone: string, body: string): Promise<WhatsAppSendResult>;
}

class MockWhatsAppProvider implements WhatsAppProvider {
  name = "mock";

  async sendText(phone: string, body: string): Promise<WhatsAppSendResult> {
    console.log(`[whatsapp:mock] → ${phone}\n${body}\n`);
    await prisma.messageLog.create({
      data: {
        phone,
        direction: "outbound",
        body,
        metaJson: JSON.stringify({ provider: "mock" }),
      },
    });
    return { ok: true, provider: "mock", id: `mock_${Date.now()}` };
  }
}

class MetaWhatsAppProvider implements WhatsAppProvider {
  name = "meta";

  async sendText(phone: string, body: string): Promise<WhatsAppSendResult> {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneNumberId) {
      return {
        ok: false,
        provider: "meta",
        error: "WHATSAPP_TOKEN ou WHATSAPP_PHONE_NUMBER_ID ausente",
      };
    }

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: { body },
        }),
      },
    );

    const json = (await response.json()) as {
      messages?: Array<{ id: string }>;
      error?: { message?: string };
    };

    await prisma.messageLog.create({
      data: {
        phone,
        direction: "outbound",
        body,
        metaJson: JSON.stringify({ provider: "meta", response: json }),
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        provider: "meta",
        error: json.error?.message ?? `HTTP ${response.status}`,
      };
    }

    return {
      ok: true,
      provider: "meta",
      id: json.messages?.[0]?.id,
    };
  }
}

export function getWhatsAppProvider(): WhatsAppProvider {
  const mode = (process.env.WHATSAPP_PROVIDER ?? "mock").toLowerCase();
  if (mode === "meta") return new MetaWhatsAppProvider();
  return new MockWhatsAppProvider();
}

export async function sendWhatsApp(phone: string, body: string) {
  return getWhatsAppProvider().sendText(phone, body);
}
