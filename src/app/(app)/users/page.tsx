import type { Metadata } from "next";
import { mustUser, requirePermission } from "@/lib/auth-user";
import { prisma } from "@/lib/prisma";
import { fiscalYear } from "@/lib/fiscal";
import { PageHeader } from "@/components/page-header";
import { UsersPanel } from "@/components/users-panel";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const user = await mustUser();
  requirePermission(user, "manage:users");
  const fy = fiscalYear();

  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      include: {
        role: { select: { id: true, name: true, permissions: true } },
        leaveBalances: {
          where: { fiscalYear: fy },
          select: { leaveType: true, allocated: true, perMonth: true, used: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Prisma Decimal does not cross the server/client boundary, so send a number.
  const userRows = users.map((u) => ({
    ...u,
    salary: u.salary === null ? null : Number(u.salary),
    annualSalary: u.salaryBasis === "ANNUAL",
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