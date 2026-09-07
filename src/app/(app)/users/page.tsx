import { mustUser, requirePermission } from "@/lib/auth-user";
import { prisma } from "@/lib/prisma";
import { fiscalYear } from "@/lib/fiscal";
import { UsersPanel } from "@/components/users-panel";

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage user accounts, roles, and leave allocations for {fy}.
          </p>
        </div>
      </div>
      <UsersPanel
        currentUserId={user.id}
        isSuperAdmin={user.isSuperAdmin}
        users={users}
        roles={roles}
        fiscalYear={fy}
      />
    </div>
  );
}