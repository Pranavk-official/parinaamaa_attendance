import { prisma } from "@/lib/prisma";
import { countDays, fiscalYear, remainingDays, toDateOnly } from "@/lib/fiscal";
import {
  compensatoryEarned,
  isLeaveExempt,
  leftEarly,
  resolveLeaveType,
} from "@/lib/leave-policy";
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
  // Also the idempotency guard for the compensatory credit below: a day can
  // only be punched out once.
  if (existing.punchOut) return { error: "Already punched out" };
  const attendance = await prisma.attendance.update({
    where: { id: existing.id },
    data: { punchOut: new Date() },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: { select: { permissions: true } } },
  });
  // Exempt staff carry no balances, so neither rule below applies to them.
  if (!user || isLeaveExempt(user)) return { attendance, compensatoryEarned: 0 };

  const fy = fiscalYear(date);
  const offday = attendance.type === "OFFDAY_WORK";

  const earned = offday
    ? compensatoryEarned(
        (attendance.punchOut!.getTime() - attendance.punchIn.getTime()) / 3_600_000
      )
    : 0;
  if (earned > 0) {
    await prisma.leaveBalance.upsert({
      where: {
        userId_fiscalYear_leaveType: { userId, fiscalYear: fy, leaveType: "COMPENSATORY" },
      },
      create: { userId, fiscalYear: fy, leaveType: "COMPENSATORY", allocated: earned },
      update: { allocated: { increment: earned } },
    });
  }

  // Leaving before the afternoon session means only the morning was worked, so
  // the other half becomes a leave request for a manager to action.
  const halfDay =
    !offday && attendance.punchOut !== null && leftEarly(attendance.punchOut);
  if (halfDay) await markEarlyLeave(userId, date, fy);

  return { attendance, compensatoryEarned: earned, halfDay };
}

async function markEarlyLeave(userId: string, date: Date, fy: string) {
  // One punch-out per day already, but a hand-filed request for the same date
  // should not be doubled up either.
  const existing = await prisma.leaveRequest.findFirst({
    where: { userId, startDate: date },
  });
  if (existing) return;

  const balance = await prisma.leaveBalance.findUnique({
    where: { userId_fiscalYear_leaveType: { userId, fiscalYear: fy, leaveType: "PAID" } },
  });
  const requested = countDays(date, date, true);

  await prisma.leaveRequest.create({
    data: {
      userId,
      type: resolveLeaveType("PAID", remainingDays(balance), requested),
      startDate: date,
      endDate: date,
      isHalfDay: true,
      halfDaySession: "AFTERNOON",
      reason: "Punched out before the afternoon session",
      status: "PENDING",
    },
  });
}