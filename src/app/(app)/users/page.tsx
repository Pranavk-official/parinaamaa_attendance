import type { Metadata } from "next";
import { mustUser, requirePermission } from "@/lib/auth/auth-user";
import { prisma } from "@/lib/db/prisma";
import { fiscalYear } from "@/lib/domain/fiscal";
import { getFiscalStart } from "@/lib/domain/settings";
import { PageHeader } from "@/features/shell/page-header";
import { UsersPanel } from "@/features/users/users-panel";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const user = await mustUser();
  requirePermission(user, "manage:users");
  const fy = fiscalYear(new Date(), await getFiscalStart());

  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      include: {
        role: { select: { id: true, name: true, permissions: true } },
        leaveBalances: {
          where: { fiscalYear: fy },
          select: { leaveType: true, allocated: true, perMonth: true, used: true },
        },
        salaryHistory: {
          orderBy: { createdAt: "desc" },
          select: { salary: true, basis: true, createdAt: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Prisma Decimal does not cross the server/client boundary, so send a number.
  // Dates go over as YYYY-MM-DD strings for the date inputs.
  const userRows = users.map((u) => ({
    ...u,
    salary: u.salary === null ? null : Number(u.salary),
    annualSalary: u.salaryBasis === "ANNUAL",
    joinedDate: u.joinedDate ? u.joinedDate.toISOString().slice(0, 10) : null,
    relievingDate: u.relievingDate ? u.relievingDate.toISOString().slice(0, 10) : null,
    salaryHistory: u.salaryHistory.map((h) => ({
      ...h,
      salary: h.salary === null ? null : Number(h.salary),
    })),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users"
        subtitle={`Manage accounts, roles, and leave allocations for ${fy}.`}
      />
      <UsersPanel
        currentUserId={user.id}
        isSuperAdmin={user.isSuperAdmin}
        users={userRows}
        roles={roles}
        fiscalYear={fy}
      />
    </div>
  );
}