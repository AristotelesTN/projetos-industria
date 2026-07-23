import { NextResponse } from "next/server";
import { processDueReminders } from "@/lib/reminders/tick";

export async function POST() {
  const result = await processDueReminders();
  return NextResponse.json(result);
}

export async function GET() {
  const result = await processDueReminders();
  return NextResponse.json(result);
}
