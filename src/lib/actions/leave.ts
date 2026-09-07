"use server";

import { revalidatePath } from "next/cache";
import { prisma, prismaWithAudit } from "@/lib/prisma";
import { mustUser, requirePermission } from "@/lib/auth-user";
import { isLeaveExempt } from "@/lib/leave-policy";
import { countDays, fiscalYear, monthsElapsedInFiscalYear, toDateOnly } from "@/lib/fiscal";
import type { HalfDaySession, LeaveType } from "@/generated/prisma/client";

export type LeaveFormInput = {
  type: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  isHalfDay: boolean;
  halfDaySession: HalfDaySession | null;
  reason: string;
};

function gmailComposeUrl(to: string, cc: string | undefined, subject: string, body: string) {
  const q = new URLSearchParams({
    view: "cm",
    fs: "1",
    to,
    ...(cc ? { cc } : {}),
    su: subject,
    body,
  });
  return `https://mail.google.com/mail/?${q.toString()}`;
}

const LEAVE_DAYS_TYPE: Record<LeaveType, number> = {
  REGULAR: 1,
  PAID: 1,
  COMPENSATORY: 1,
  HALF_DAY: 0.5,
};

const HALF_SESSION_LABEL: Record<HalfDaySession, string> = {
  MORNING: "morning (9:30 AM - 2:00 PM)",
  AFTERNOON: "afternoon (2:00 PM - 6:30 PM)",
};

function daysForRequest(start: Date, end: Date, type: LeaveType, isHalfDay: boolean) {
  return countDays(start, end, isHalfDay) * LEAVE_DAYS_TYPE[type];
}

export async function submitLeaveAction(input: LeaveFormInput) {
  const user = await mustUser();
  if (isLeaveExempt(user)) return { error: "Admins do not apply for leave." };
  const fy = fiscalYear();
  const start = toDateOnly(new Date(`${input.startDate}T00:00:00Z`));
  const end = toDateOnly(new Date(`${input.endDate}T00:00:00Z`));
  if (end < start) return { error: "End date before start date" };

  const dayMultiplier = LEAVE_DAYS_TYPE[input.type];
  const requested = countDays(start, end, input.isHalfDay) * dayMultiplier;

  const isHalf = input.isHalfDay || input.type === "HALF_DAY";
  if (isHalf && !input.halfDaySession) {
    return { error: "Choose morning or afternoon for a half day." };
  }

  if (
    (input.type === "PAID" || input.type === "HALF_DAY") &&
    !isLeaveExempt(user)
  ) {
    const balance = await prisma.leaveBalance.findUnique({
      where: {
        userId_fiscalYear_leaveType: { userId: user.id, fiscalYear: fy, leaveType: input.type },
      },
    });
    // PAID leave can accrue per month (perMonth) instead of a fixed annual lump.
    const remaining =
      (balance?.perMonth ?? 0) > 0
        ? (balance?.perMonth ?? 0) * monthsElapsedInFiscalYear() - (balance?.used ?? 0)
        : (balance?.allocated ?? 0) - (balance?.used ?? 0);
    if (remaining < requested) {
      return { error: `Insufficient ${input.type} balance. Remaining: ${remaining} day(s).` };
    }
  }

  const request = await prisma.leaveRequest.create({
    data: {
      userId: user.id,
      type: input.type,
      startDate: start,
      endDate: end,
      isHalfDay: input.isHalfDay,
      halfDaySession: isHalf ? input.halfDaySession : null,
      reason: input.reason,
    },
  });

  const manager = process.env.MANAGER_EMAIL;
  if (manager) {
    const subject = `Leave request ${request.type} (${fy}) - ${user.name}`;
    const body = [
      `Name: ${user.name}`,
      `Designation: ${user.designation ?? "-"}`,
      `Type: ${request.type}`,
      ...(isHalf && input.halfDaySession
        ? [`Session: ${HALF_SESSION_LABEL[input.halfDaySession]}`]
        : []),
      `Dates: ${input.startDate} to ${input.endDate}`,
      `Days: ${requested}`,
      `Reason: ${input.reason}`,
      `Approve here: ${process.env.BETTER_AUTH_URL}/leaves`,
    ].join("\n");
    return {
      ok: true as const,
      composeUrl: gmailComposeUrl(manager, user.email, subject, body),
    };
  }
  return { ok: true as const };
}

export async function approveLeaveAction(id: string) {
  const actor = await mustUser();
  requirePermission(actor, "manage:leaves");
  const audit = prismaWithAudit(actor.id);

  return audit.$transaction(async (tx) => {
    const request = await tx.leaveRequest.findUniqueOrThrow({
      where: { id },
      include: { user: { include: { role: { select: { permissions: true } } } } },
    });
    if (request.status === "APPROVED") return { ok: true as const, already: true as const, composeUrl: null as string | null };

    // Exempt users (admins, MD, accounts) have no leave balance to track.
    if (isLeaveExempt(request.user)) {
      await tx.leaveRequest.update({ where: { id }, data: { status: "APPROVED" } });
      return { ok: true as const, already: false as const, composeUrl: null as string | null };
    }

    const requested = daysForRequest(
      request.startDate,
      request.endDate,
      request.type,
      request.isHalfDay
    );

    const fy = fiscalYear(request.startDate);
    await tx.leaveBalance.upsert({
      where: {
        userId_fiscalYear_leaveType: {
          userId: request.userId,
          fiscalYear: fy,
          leaveType: request.type,
        },
      },
      create: {
        userId: request.userId,
        fiscalYear: fy,
        leaveType: request.type,
        allocated: 0,
        used: requested,
      },
      update: { used: { increment: requested } },
    });
    await tx.leaveRequest.update({
      where: { id },
      data: { status: "APPROVED" },
    });
    const composeUrl = gmailComposeUrl(
      request.user.email,
      process.env.MANAGER_EMAIL,
      `Leave approved (${fy})`,
      [
        `Your ${request.type} leave request for ${request.startDate.toISOString().slice(0, 10)} to ${request.endDate.toISOString().slice(0, 10)} has been approved.`,
        `Days: ${requested}`,
      ].join("\n")
    );
    return { ok: true as const, already: false as const, composeUrl };
  }).then((result) => {
    revalidatePath("/leaves");
    revalidatePath("/");
    return result;
  });
}

export async function rejectLeaveAction(id: string) {
  const actor = await mustUser();
  requirePermission(actor, "manage:leaves");

  const request = await prismaWithAudit(actor.id).leaveRequest.update({
    where: { id },
    data: { status: "REJECTED" },
    include: { user: { select: { email: true } } },
  });
  const composeUrl = gmailComposeUrl(
    request.user.email,
    process.env.MANAGER_EMAIL,
    "Leave request rejected",
    [
      `Your ${request.type} leave request for ${request.startDate.toISOString().slice(0, 10)} to ${request.endDate.toISOString().slice(0, 10)} was rejected.`,
      "Contact your manager for details.",
    ].join("\n")
  );
  revalidatePath("/leaves");
  return { ok: true as const, composeUrl };
}

export async function getLeaveBalances(userId: string) {
  return prisma.leaveBalance.findMany({
    where: { userId, fiscalYear: fiscalYear() },
  });
}