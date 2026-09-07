import { prisma } from "@/lib/prisma";
import { toDateOnly } from "@/lib/fiscal";
import type { AttendanceType } from "@/generated/prisma/client";

export async function punchIn(userId: string, preferred: "WFO" | "WFH") {
  const now = new Date();
  const date = toDateOnly(now);

  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date } },
  });
  // Idempotent: punch-in at 9am, open again at noon, no duplicate row.
  if (existing) return { alreadyPunched: true, attendance: existing };

  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;
  const holiday = await prisma.companyHoliday.findUnique({ where: { date } });
  const type: AttendanceType = isWeekend || holiday ? "OFFDAY_WORK" : preferred;

  const attendance = await prisma.attendance.create({
    data: { userId, date, punchIn: now, type },
  });
  return { alreadyPunched: false, attendance };
}

export async function punchOut(userId: string) {
  const date = toDateOnly(new Date());
  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date } },
  });
  if (!existing) return { error: "No punch-in for today" };
  if (existing.punchOut) return { error: "Already punched out" };
  const attendance = await prisma.attendance.update({
    where: { id: existing.id },
    data: { punchOut: new Date() },
  });
  return { attendance };
}