"use server";

import { revalidatePath } from "next/cache";
import { prisma, prismaWithAudit } from "@/lib/prisma";
import { hasPermission, mustUser, requirePermission } from "@/lib/auth-user";
import { isLeaveExempt, resolveLeaveType } from "@/lib/leave-policy";
import {
  LEAVE_MAIL,
  gmailComposeUrl,
  leaveMailBody,
  leaveMailSubject,
  rejectMailBody,
  rejectMailSubject,
} from "@/lib/leave-mail";
import { countDays, fiscalYear, remainingDays, toDateOnly } from "@/lib/fiscal";
import { getFiscalStart } from "@/lib/settings";
import type { HalfDaySession, LeaveType } from "@/generated/prisma/client";

export type LeaveFormInput = {
  type: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  isHalfDay: boolean;
  halfDaySession: HalfDaySession | null;
  reason: string;
  // Edited in the form's email accordion; the generated draft is used when absent.
  mailSubject?: string;
  mailBody?: string;
  mailCc?: string;
};

// The To address can still be overridden by MANAGER_EMAIL for a different org.
const MAIL_TO = process.env.MANAGER_EMAIL || LEAVE_MAIL.to;

// Long enough for a full letter, short enough to survive as a URL.
const MAX_MAIL_FIELD = 4000;

function trimField(v: string | undefined, fallback: string) {
  const t = (v ?? "").trim();
  return t === "" ? fallback : t.slice(0, MAX_MAIL_FIELD);
}

/** Default accounts copy plus any extra recipients from the form, comma-joined. */
function ccField(extra: string | undefined) {
  return [LEAVE_MAIL.cc, trimField(extra, "")].filter(Boolean).join(", ");
}

export async function submitLeaveAction(input: LeaveFormInput) {
  const user = await mustUser();
  if (isLeaveExempt(user)) return { error: "Admins do not apply for leave." };
  const fyStart = await getFiscalStart();
  const fy = fiscalYear(new Date(), fyStart);
  const isHalf = input.isHalfDay;
  const start = toDateOnly(new Date(`${input.startDate}T00:00:00Z`));
  // A half day covers one date only, so the range collapses onto the start.
  const end = isHalf ? start : toDateOnly(new Date(`${input.endDate}T00:00:00Z`));
  if (end < start) return { error: "End date before start date" };
  if (isHalf && start < toDateOnly(new Date())) {
    return { error: "A half day can only be requested for today or a later date." };
  }

  const requested = countDays(start, end, isHalf);

  if (isHalf && !input.halfDaySession) {
    return { error: "Choose morning or afternoon for a half day." };
  }

  // The paid balance decides whether this is paid or unpaid, whichever the
  // employee picked. Half days draw 0.5 from that same balance.
  const paidBalance =
    input.type === "COMPENSATORY"
      ? null
      : await prisma.leaveBalance.findUnique({
          where: {
            userId_fiscalYear_leaveType: { userId: user.id, fiscalYear: fy, leaveType: "PAID" },
          },
        });
  const type = resolveLeaveType(input.type, remainingDays(paidBalance, fyStart), requested);

  await prisma.leaveRequest.create({
    data: {
      userId: user.id,
      type,
      startDate: start,
      endDate: end,
      isHalfDay: isHalf,
      halfDaySession: isHalf ? input.halfDaySession : null,
      reason: input.reason,
    },
  });

  const draft = {
    employeeName: user.name,
    designation: user.designation,
    type,
    startDate: input.startDate,
    endDate: isHalf ? input.startDate : input.endDate,
    days: requested,
    isHalfDay: isHalf,
    halfDaySession: input.halfDaySession,
    reason: input.reason,
  };
  return {
    ok: true as const,
    type,
    composeUrl: gmailComposeUrl({
      to: MAIL_TO,
      cc: ccField(input.mailCc),
      subject: trimField(input.mailSubject, leaveMailSubject(draft)),
      body: `${trimField(input.mailBody, leaveMailBody(draft))}\n\nApprove here: ${process.env.BETTER_AUTH_URL}/leaves`,
    }),
  };
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

    const requested = countDays(request.startDate, request.endDate, request.isHalfDay);

    const start = await getFiscalStart();
    const fy = fiscalYear(request.startDate, start);
    // The balance is spent here, so re-decide against it: the paid days left at
    // approval time are the ones that matter, not the ones left at submission.
    const paidBalance =
      request.type === "COMPENSATORY"
        ? null
        : await tx.leaveBalance.findUnique({
            where: {
              userId_fiscalYear_leaveType: {
                userId: request.userId,
                fiscalYear: fy,
                leaveType: "PAID",
              },
            },
          });
    const type = resolveLeaveType(request.type, remainingDays(paidBalance, start), requested);

    await tx.leaveBalance.upsert({
      where: {
        userId_fiscalYear_leaveType: { userId: request.userId, fiscalYear: fy, leaveType: type },
      },
      create: {
        userId: request.userId,
        fiscalYear: fy,
        leaveType: type,
        allocated: 0,
        used: requested,
      },
      update: { used: { increment: requested } },
    });
    await tx.leaveRequest.update({
      where: { id },
      data: { status: "APPROVED", type },
    });
    const composeUrl = gmailComposeUrl({
      to: request.user.email,
      cc: LEAVE_MAIL.cc,
      subject: `Leave approved (${fy})`,
      body: [
        `Dear ${request.user.name},`,
        "",
        `Your ${type} leave request for ${request.startDate.toISOString().slice(0, 10)} to ${request.endDate.toISOString().slice(0, 10)} has been approved.`,
        `Days: ${requested}`,
        ...(type === request.type
          ? []
          : type === "REGULAR"
            ? ["Note: your paid balance was exhausted, so this is unpaid regular leave."]
            : ["Note: you had paid days left, so this was taken as paid leave."]),
        "",
        "Kind regards,",
        LEAVE_MAIL.managerName,
      ].join("\n"),
    });
    return { ok: true as const, already: false as const, composeUrl };
  }).then((result) => {
    revalidatePath("/leaves");
    revalidatePath("/");
    return result;
  });
}

export async function rejectLeaveAction(
  id: string,
  // Edited in the reject dialog; the generated draft is used when absent.
  mail?: { subject?: string; body?: string; cc?: string }
) {
  const actor = await mustUser();
  requirePermission(actor, "manage:leaves");

  const request = await prismaWithAudit(actor.id).leaveRequest.update({
    where: { id },
    data: { status: "REJECTED" },
    include: { user: { select: { name: true, email: true } } },
  });
  const draft = {
    employeeName: request.user.name,
    type: request.type,
    startDate: request.startDate.toISOString().slice(0, 10),
    endDate: request.endDate.toISOString().slice(0, 10),
    days: countDays(request.startDate, request.endDate, request.isHalfDay),
  };
  const composeUrl = gmailComposeUrl({
    to: request.user.email,
    cc: ccField(mail?.cc),
    subject: trimField(mail?.subject, rejectMailSubject(draft)),
    body: trimField(mail?.body, rejectMailBody(draft)),
  });
  revalidatePath("/leaves");
  return { ok: true as const, composeUrl };
}

export async function getLeaveBalances(userId: string) {
  return prisma.leaveBalance.findMany({
    where: { userId, fiscalYear: fiscalYear(new Date(), await getFiscalStart()) },
  });
}

export async function deleteLeaveAction(id: string) {
  const actor = await mustUser();
  const request = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!request) return { error: "Request not found" };
  if (request.userId !== actor.id && !hasPermission(actor, "manage:leaves")) {
    return { error: "You can only delete your own requests" };
  }
  // ponytail: pending only. Deleting an approved request would also have to
  // give back the balance day it already spent; add that when someone asks.
  if (request.status !== "PENDING") {
    return { error: "Only a pending request can be deleted" };
  }

  await prismaWithAudit(actor.id).leaveRequest.delete({ where: { id } });
  revalidatePath("/leaves");
  revalidatePath("/");
  return { ok: true as const };
}
