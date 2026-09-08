"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarCheck,
  CalendarPlus,
  ChevronsUpDown,
  Ellipsis,
  FileSpreadsheet,
  FileText,
  Inbox,
  LayoutDashboard,
  LogOut,
  Shield,
  Users,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
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
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

/** Bottom nav shows this many items; the rest live behind "More". */
const BOTTOM_NAV_SLOTS = 4;

/** A route, or an in-place action such as signing out. */
type NavItem = {
  label: string;
  icon: typeof LayoutDashboard;
  href?: string;
  onClick?: () => void;
};

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function SignOutDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign out?</AlertDialogTitle>
          <AlertDialogDescription>
            You will need to sign in again to access your account.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              onOpenChange(false);
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
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function NavUser({
  name,
  email,
  onSignOut,
}: {
  name: string;
  email: string;
  onSignOut: () => void;
}) {
  const { isMobile } = useSidebar();
  const avatar = (
    <Avatar>
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />}
          >
            {avatar}
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{name}</span>
              <span className="truncate text-xs">{email}</span>
            </div>
            <ChevronsUpDown className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-fit"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            {/* GroupLabel needs a Group around it, or Base UI throws. */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  {avatar}
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{name}</span>
                    <span className="truncate text-xs">{email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function bottomNavItemClass(active: boolean) {
  return cn(
    // min-h-14 keeps the tap target at/above the 44px minimum.
    "relative h-auto min-h-14 min-w-0 flex-1 flex-col gap-1 rounded-none px-1 py-2 text-[0.6875rem] font-normal",
    "before:absolute before:inset-x-3 before:top-0 before:h-0.5 before:bg-primary before:transition-opacity",
    active ? "text-primary before:opacity-100" : "text-muted-foreground before:opacity-0",
  );
}

/**
 * Mobile app bar. "More" opens the sidebar sheet; it is rendered only when it
 * earns its slot — for something that overflows, or to give staff their only
 * mobile route to the account menu. Employees carry their own sign-out item,
 * so their four tabs are the whole nav.
 */
function BottomNav({
  items,
  pathname,
  showMore,
}: {
  items: NavItem[];
  pathname: string;
  showMore: boolean;
}) {
  const { setOpenMobile } = useSidebar();
  const primary = items.slice(0, showMore ? BOTTOM_NAV_SLOTS : BOTTOM_NAV_SLOTS + 1);
  const overflow = items.slice(primary.length);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="flex items-stretch">
        {primary.map((item) => {
          const Icon = item.icon;
          const active = item.href === pathname;
          return (
            <Button
              key={item.label}
              variant="ghost"
              className={bottomNavItemClass(active)}
              onClick={item.onClick}
              {...(item.href
                ? {
                    render: (
                      <Link href={item.href} aria-current={active ? "page" : undefined} />
                    ),
                  }
                : {})}
            >
              <Icon className="size-5" />
              <span className="truncate">{item.label}</span>
            </Button>
          );
        })}
        {showMore && (
          <Button
            variant="ghost"
            aria-label="More"
            className={bottomNavItemClass(overflow.some((i) => i.href === pathname))}
            onClick={() => setOpenMobile(true)}
          >
            <Ellipsis className="size-5" />
            <span className="truncate">More</span>
          </Button>
        )}
      </div>
    </nav>
  );
}

export function Nav({
  name,
  email,
  isEmployee,
  canManageUsers,
  canViewReports,
  children,
}: {
  name: string;
  email: string;
  isEmployee: boolean;
  canManageUsers: boolean;
  canViewReports: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);

  const items: NavItem[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    ...(isEmployee ? [{ href: "/leaves/new", label: "Apply Leave", icon: CalendarPlus }] : []),
    { href: "/leaves", label: isEmployee ? "My Leave" : "Leave Queue", icon: Inbox },
    ...(canManageUsers ? [{ href: "/users", label: "Users", icon: Users }] : []),
    ...(canViewReports
      ? [
          { href: "/audit", label: "Audit Log", icon: FileText },
          { href: "/reports", label: "Reports", icon: FileSpreadsheet },
        ]
      : []),
    // Employees get a direct sign-out where staff get session management.
    isEmployee
      ? { label: "Log out", icon: LogOut, onClick: () => setSigningOut(true) }
      : { href: "/security", label: "Security", icon: Shield },
  ];
  const current = items.find((i) => i.href === pathname);
  // Employees get every item as a tab plus their own sign-out, so "More" would
  // open a sheet that shows them nothing new. Staff keep it: it is their only
  // mobile route to the account menu.
  const showMore = !isEmployee;

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" render={<Link href="/" />}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <CalendarCheck className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Attendance</span>
                  <span className="truncate text-xs">Leave &amp; hours</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        isActive={item.href === pathname}
                        tooltip={item.label}
                        onClick={item.onClick}
                        {...(item.href ? { render: <Link href={item.href} /> } : {})}
                      >
                        <Icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <NavUser name={name} email={email} onSignOut={() => setSigningOut(true)} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      {/* min-w-0: without it this flex item keeps min-width:auto and wide
          tables stretch the page instead of scrolling inside their container. */}
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b bg-background/85 backdrop-blur-sm transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex w-full items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1 hidden md:flex" />
            <Separator
              orientation="vertical"
              className="mr-2 hidden data-vertical:h-4 data-vertical:self-auto md:block"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>{current?.label ?? "Attendance"}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto">
              <ThemeSwitcher />
            </div>
          </div>
        </header>
        <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col gap-4 p-4 pb-24 md:p-6 md:pb-6">
          {children}
        </div>
      </SidebarInset>

      <BottomNav items={items} pathname={pathname} showMore={showMore} />
      <SignOutDialog open={signingOut} onOpenChange={setSigningOut} />
    </SidebarProvider>
  );
}
