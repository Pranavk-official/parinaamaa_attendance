"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, CalendarPlus, Inbox, Shield, FileText, FileSpreadsheet, Users } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ThemeSwitcher } from "@/components/theme-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarSeparator,
} from "@/components/ui/sidebar";

const BASE_LINKS = [{ href: "/", label: "Dashboard", icon: LayoutDashboard }];

const SECURITY_LINK = { href: "/security", label: "Security", icon: Shield };

export function Nav({
  name,
  canManageUsers,
  canViewReports,
  canApplyLeave,
  children,
}: {
  name: string;
  canManageUsers: boolean;
  canViewReports: boolean;
  canApplyLeave: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const links = [
    ...BASE_LINKS,
    ...(canApplyLeave ? [{ href: "/leaves/new", label: "Apply Leave", icon: CalendarPlus }] : []),
    { href: "/leaves", label: "Leave Queue", icon: Inbox },
    ...(canManageUsers ? [{ href: "/users", label: "Users", icon: Users }] : []),
    ...(canViewReports
      ? [
          { href: "/audit", label: "Audit Log", icon: FileText },
          { href: "/reports", label: "Reports", icon: FileSpreadsheet },
        ]
      : []),
    SECURITY_LINK,
  ];

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <span className="font-semibold tracking-tight">Attendance</span>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {links.map((l) => {
                  const Icon = l.icon;
                  return (
                    <SidebarMenuItem key={l.href}>
                      <SidebarMenuButton
                        render={<Link href={l.href} />}
                        isActive={pathname === l.href}
                        tooltip={l.label}
                      >
                        <Icon />
                        <span>{l.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarSeparator />
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center gap-3 p-2">
            <span className="truncate text-sm text-muted-foreground">{name}</span>
            <div className="ml-auto flex items-center gap-2">
              <ThemeSwitcher />
              <Dialog open={signOutOpen} onOpenChange={setSignOutOpen}>
                <DialogTrigger
                  render={
                    <Button variant="outline" size="icon" aria-label="Sign out">
                      <LogOut />
                    </Button>
                  }
                />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Sign out?</DialogTitle>
                    <DialogDescription>
                      You will need to sign in again to access your account.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setSignOutOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setSignOutOpen(false);
                        authClient.signOut({
                          fetchOptions: {
                            onSuccess: () => {
                              router.push("/login");
                              router.refresh();
                            },
                          },
                        });
                      }}
                    >
                      Sign out
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-16 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}