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
