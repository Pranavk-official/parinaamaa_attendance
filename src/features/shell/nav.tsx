"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarCheck,
  ChevronsUpDown,
  Ellipsis,
  Fingerprint,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/auth-client";
import { punchOutAction } from "@/lib/server/actions/attendance";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ThemeSwitcher } from "@/features/shell/theme-switcher";
import {
  BOTTOM_NAV_SLOTS,
  getNavGroups,
  type NavItem,
} from "@/features/shell/nav-items";
import { usePasskeySupported } from "@/hooks/use-passkey-support";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function useSignOut() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const signOut = () =>
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
          router.refresh();
        },
      },
    });

  const signOutAfterPunch = (done: () => void) =>
    startTransition(async () => {
      const res = await punchOutAction();
      if (res.error) {
        toast.error(res.error);
        return;
      }
      done();
      signOut();
    });

  return { pending, signOut, signOutAfterPunch };
}

function SignOutDialog({
  open,
  onOpenChange,
  canPunchOut,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canPunchOut: boolean;
}) {
  const { pending, signOut, signOutAfterPunch } = useSignOut();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign out?</AlertDialogTitle>
          <AlertDialogDescription>
            {canPunchOut
              ? "You are still punched in for today. Sign out on its own leaves the day open."
              : "You will need to sign in again to access your account."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={canPunchOut ? "outline" : "destructive"}
            disabled={pending}
            onClick={() => {
              onOpenChange(false);
              signOut();
            }}
          >
            Sign out
          </AlertDialogAction>
          {canPunchOut && (
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
            onClick={() => signOutAfterPunch(() => onOpenChange(false))}
            >
              {pending && <Spinner />}
              Punch out and sign out
            </AlertDialogAction>
          )}
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
  const passkeySupported = usePasskeySupported();
  const avatar = (
    <Avatar>
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );

  // Registration needs a signed-in session, so it lives here — not on login.
  const addPasskey = async () => {
    const res = await authClient.passkey.addPasskey();
    if (res?.error) toast.error(res.error.message ?? "Could not set up passkey");
    else toast.success("Passkey added — use it on your next sign-in");
  };

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
            {passkeySupported && (
              <DropdownMenuItem onClick={addPasskey}>
                <Fingerprint />
                Set up passkey
              </DropdownMenuItem>
            )}
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
    "relative h-auto min-h-14 min-w-0 flex-1 flex-col gap-1 rounded-none px-1 py-2 text-xs font-normal",
    "before:absolute before:inset-x-3 before:top-0 before:h-0.5 before:bg-primary before:transition-opacity",
    active ? "text-primary before:opacity-100" : "text-muted-foreground before:opacity-0",
  );
}

/**
 * The overflow sheet behind the "More" tab: routes that did not fit, plus the
 * account, theme and sign-out that a phone has no other route to. It opens
 * upward from the tab that summons it, so origin and destination agree.
 */
function MoreSheet({
  open,
  onOpenChange,
  items,
  pathname,
  name,
  email,
  canPunchOut,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: NavItem[];
  pathname: string;
  name: string;
  email: string;
  canPunchOut: boolean;
}) {
  const close = () => onOpenChange(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const { pending, signOut, signOutAfterPunch } = useSignOut();
  const passkeySupported = usePasskeySupported();
  const closeAll = () => {
    setSignOutOpen(false);
    close();
  };

  // Registration needs a signed-in session — same call as the desktop menu.
  const addPasskey = async () => {
    const res = await authClient.passkey.addPasskey();
    if (res?.error) toast.error(res.error.message ?? "Could not set up passkey");
    else {
      toast.success("Passkey added — use it on your next sign-in");
      close();
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      <DrawerContent className="gap-0 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <DrawerHeader className="flex-row items-center gap-3 border-b p-4">
          <Avatar>
            <AvatarFallback>{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 flex-1">
            <DrawerTitle className="truncate text-sm">{name}</DrawerTitle>
            <DrawerDescription className="truncate">{email}</DrawerDescription>
          </div>
        </DrawerHeader>

        <div className="flex flex-col p-2">
          {items.map((item) => {
            const Icon = item.icon;
            const active = item.href === pathname;
            return (
              <Button
                key={item.label}
                variant="ghost"
                onClick={close}
                className={cn(
                  "h-11 justify-center gap-3 rounded-none px-3 text-sm font-normal",
                  active && "bg-accent text-accent-foreground",
                )}
                render={
                  <Link href={item.href} aria-current={active ? "page" : undefined} />
                }
              >
                <Icon className="size-5" />
                {item.label}
              </Button>
            );
          })}
          {passkeySupported && (
            <Button
              variant="ghost"
              className="h-11 justify-center gap-3 rounded-none px-3 text-sm font-normal"
              onClick={addPasskey}
            >
              <Fingerprint className="size-5" />
              Set up passkey
            </Button>
          )}
          <Button
            variant="ghost"
            className="h-11 justify-center gap-3 rounded-none px-3 text-sm font-normal"
            onClick={() => setSignOutOpen(true)}
          >
            <LogOut className="size-5" />
            Sign out
          </Button>
        </div>

        <p className="px-4 text-center text-xs text-muted-foreground">Version {process.env.NEXT_PUBLIC_APP_VERSION}</p>
      </DrawerContent>

      <Drawer
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        showSwipeHandle
      >
        <DrawerContent className="gap-0 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <DrawerHeader>
            <DrawerTitle className="text-center">Sign out?</DrawerTitle>
            <DrawerDescription className="text-center">
            {canPunchOut
              ? "You are still punched in for today. Sign out on its own leaves the day open."
              : "You&apos;ll need your password to sign back in."}
          </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter className="flex-col items-stretch">
            <Button
              variant={canPunchOut ? "outline" : "destructive"}
              disabled={pending}
              onClick={() => {
                closeAll();
                signOut();
              }}
            >
              <LogOut className="size-4" />
              Sign out
            </Button>
            {canPunchOut && (
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() => signOutAfterPunch(closeAll)}
              >
                {pending && <Spinner />}
                Punch out and sign out
              </Button>
            )}
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setSignOutOpen(false)}
            >
              Keep the app open
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </Drawer>
  );
}

/**
 * The whole of mobile navigation: four routes plus "More". There is no drawer
 * and no app bar behind it — one bar, one place to look, and the page's own
 * <h1> is its title.
 */
function BottomNav({
  items,
  pathname,
  onMore,
  moreActive,
}: {
  items: NavItem[];
  pathname: string;
  onMore: () => void;
  moreActive: boolean;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="flex items-stretch">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.href === pathname;
          return (
            <Button
              key={item.label}
              variant="ghost"
              className={bottomNavItemClass(active)}
              render={
                <Link href={item.href} aria-current={active ? "page" : undefined} />
              }
            >
              <Icon className="size-5" />
              <span className="truncate">{item.short ?? item.label}</span>
            </Button>
          );
        })}
        <Button
          variant="ghost"
          className={bottomNavItemClass(moreActive)}
          onClick={onMore}
        >
          <Ellipsis className="size-5" />
          <span className="truncate">More</span>
        </Button>
      </div>
    </nav>
  );
}

export function Nav({
  name,
  email,
  isEmployee,
  canPunchOut,
  canManageUsers,
  canViewReports,
  children,
}: {
  name: string;
  email: string;
  isEmployee: boolean;
  canPunchOut: boolean;
  canManageUsers: boolean;
  canViewReports: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Grouped for the sidebar; BottomNav flattens them back into tabs.
  const groups = getNavGroups({ isEmployee, canManageUsers, canViewReports });
  const items: NavItem[] = groups.flatMap((g) => g.items);
  const current = items.find((i) => i.href === pathname);
  // Four tabs and a "More"; whatever does not fit joins the account, theme and
  // sign-out in the sheet behind it.
  const tabs = items.slice(0, BOTTOM_NAV_SLOTS);
  const overflow = items.slice(BOTTOM_NAV_SLOTS);

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
          {groups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton
                          isActive={item.href === pathname}
                          tooltip={item.label}
                          render={<Link href={item.href} />}
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
          ))}
        </SidebarContent>
        <SidebarFooter>
          {/* The border makes the account block read as its own card, and
              collapses away with the rest of the labels in icon mode. */}
          <div className="rounded-md border border-sidebar-border group-data-[collapsible=icon]:border-transparent">
            <NavUser name={name} email={email} onSignOut={() => setSigningOut(true)} />
          </div>
          <p className="px-2 pb-1 text-center text-xs text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
            Version {process.env.NEXT_PUBLIC_APP_VERSION}
          </p>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      {/* min-w-0: without it this flex item keeps min-width:auto and wide
          tables stretch the page instead of scrolling inside their container. */}
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b bg-background/85 backdrop-blur-sm transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex w-full items-center gap-2 px-4">
            {/* No drawer to open on mobile, so the trigger is desktop-only. */}
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

      <BottomNav
        items={tabs}
        pathname={pathname}
        onMore={() => setMoreOpen(true)}
        moreActive={overflow.some((i) => i.href === pathname)}
      />
      <MoreSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        items={overflow}
        pathname={pathname}
        name={name}
        email={email}
        canPunchOut={canPunchOut}
      />
      <SignOutDialog open={signingOut} onOpenChange={setSigningOut} canPunchOut={canPunchOut} />
    </SidebarProvider>
  );
}
