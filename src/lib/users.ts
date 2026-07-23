import { prisma } from "@/lib/prisma";

export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export async function getOrCreateUser(phone: string, name?: string) {
  const normalized = normalizePhone(phone);
  const existing = await prisma.user.findUnique({ where: { phone: normalized } });
  if (existing) return existing;

  return prisma.user.create({
    data: {
      phone: normalized,
      name,
      timezone: process.env.DEFAULT_TIMEZONE ?? "America/Sao_Paulo",
    },
  });
}

export async function getDefaultUser() {
  const phone = process.env.DEFAULT_USER_PHONE ?? "5511999999999";
  return getOrCreateUser(phone, "Você");
}
