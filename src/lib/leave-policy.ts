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