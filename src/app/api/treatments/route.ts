import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultUser } from "@/lib/users";

export async function GET() {
  const user = await getDefaultUser();
  const treatments = await prisma.treatment.findMany({
    where: { userId: user.id, status: { in: ["active", "draft", "completed"] } },
    include: {
      doses: {
        orderBy: { scheduledAt: "asc" },
        take: 8,
      },
      _count: { select: { doses: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ treatments });
}
