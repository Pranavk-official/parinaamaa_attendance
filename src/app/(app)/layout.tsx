import { redirect } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/auth-user";
import { isLeaveExempt } from "@/lib/leave-policy";
import { Nav } from "@/components/nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <Nav
      name={user.name}
      email={user.email}
      canManageUsers={hasPermission(user, "manage:users")}
      canViewReports={hasPermission(user, "view:reports")}
      isEmployee={!isLeaveExempt(user)}
    >
      {children}
    </Nav>
  );
}