import { redirect } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/auth-user";
import { isLeaveExempt } from "@/lib/leave-policy";
import { prisma } from "@/lib/prisma";
import { toDateOnly } from "@/lib/fiscal";
import { Nav } from "@/components/nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Someone signing out mid-shift is usually done for the day, so the sign-out
  // dialog offers to close the day too.
  const isEmployee = !isLeaveExempt(user);
  const today = isEmployee
    ? await prisma.attendance.findUnique({
        where: { userId_date: { userId: user.id, date: toDateOnly(new Date()) } },
        select: { punchOut: true },
      })
    : null;

  return (
    <Nav
      name={user.name}
      email={user.email}
      canPunchOut={today !== null && today.punchOut === null}
      canManageUsers={hasPermission(user, "manage:users")}
      canViewReports={hasPermission(user, "view:reports")}
      isEmployee={isEmployee}
    >
      {children}
    </Nav>
  );
}