import type { Prisma } from "@/generated/prisma/client";

/**
 * Tracked staff: everyone who is not leave-exempt. Payroll, reports and the
 * org dashboard all count these and nobody else.
 */
export const EMPLOYEE_WHERE: Prisma.UserWhereInput = {
  isSuperAdmin: false,
  OR: [{ roleId: null }, { role: { permissions: { isEmpty: true } } }],
};

// Active staff for dashboards, queues and payroll: never blocked, and not
// relieved before `ref` (relieving day itself still counts as active).
// Pass a payroll period's start so mid-period exits keep their worked days.
export function activeUserWhere(ref: Date = new Date()): Prisma.UserWhereInput {
  const day = new Date(Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate()));
  return {
    isBlocked: false,
    OR: [{ relievingDate: null }, { relievingDate: { gte: day } }],
  };
}

export type LeaveExemptSubject = {
  isSuperAdmin: boolean;
  role: { permissions: string[] } | null;
};

// Roles with any permissions (Admin, MD, Accounts, Super Admin) are
// organizational staff, not tracked employees: they have no leave balances
// and are never blocked by an insufficient-balance check.
export function isLeaveExempt(user: LeaveExemptSubject | null | undefined): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return (user.role?.permissions.length ?? 0) > 0;
}
// REGULAR leave is unpaid: it is never capped, and every approved day is a
// salary deduction. Half days are uncapped too. Only these two types carry a
// balance worth allocating, so they are the only ones an admin ever sets.
export const ALLOCATABLE_LEAVE_TYPES = ["PAID", "COMPENSATORY"] as const;

export function isUnpaidLeave(type: string): boolean {
  return type === "REGULAR";
}

// Paid and regular leave are one request seen through the paid balance: it is
// paid while enough paid days remain, and unpaid regular leave once they run
// out. Picking REGULAR by hand does not hold paid days back. Compensatory is
// earned separately and never converts.
export function resolveLeaveType(
  requested: string,
  paidRemaining: number,
  requestedDays: number
): "PAID" | "REGULAR" | "COMPENSATORY" {
  if (requested === "COMPENSATORY") return "COMPENSATORY";
  return paidRemaining >= requestedDays ? "PAID" : "REGULAR";
}

// Office hours are 09:30 to 18:30, Monday to Friday. Anything worked outside
// that — a weekend, or a CompanyHoliday — is recorded as OFFDAY_WORK.
export const WORK_DAY_HOURS = 9;

/**
 * Compensatory days earned by working one off day. A full shift earns a day,
 * a short one earns half, and a punch pair too brief to be real work earns
 * nothing.
 */
export function compensatoryEarned(hoursWorked: number): number {
  if (hoursWorked < 1) return 0;
  return hoursWorked < WORK_DAY_HOURS / 2 ? 0.5 : 1;
}

/** Half days split at 14:00: morning is 09:30-14:00, afternoon 14:00-18:30. */
export const AFTERNOON_START_HOUR = 14;

/** Punching out before the afternoon starts means only the morning was worked. */
export function leftEarly(punchOutAt: Date): boolean {
  return punchOutAt.getHours() < AFTERNOON_START_HOUR;
}
