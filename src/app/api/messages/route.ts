import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultUser } from "@/lib/users";

export async function GET() {
  const user = await getDefaultUser();
  const messages = await prisma.messageLog.findMany({
    where: { phone: user.phone },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return NextResponse.json({ messages, phone: user.phone });
}
