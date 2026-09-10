import {
  CalendarPlus,
  FileSpreadsheet,
  FileText,
  Inbox,
  LayoutDashboard,
  Settings2,
  Shield,
  Users,
} from "lucide-react";

/** Bottom nav shows this many items; the rest live behind "More". */
export const BOTTOM_NAV_SLOTS = 4;

export type NavItem = {
  label: string;
  href: string;
  /** Bottom-nav caption. A tab is ~1/5 of a phone's width, so long labels
      truncate there; give anything over ~7 characters a short form. */
  short?: string;
  icon: typeof LayoutDashboard;
};

export type NavGroup = { label: string; items: NavItem[] };

export type NavFlags = {
  isEmployee: boolean;
  canManageUsers: boolean;
  canViewReports: boolean;
};

// Single source for desktop sidebar + mobile bottom nav / More sheet.
export function getNavGroups({ isEmployee, canManageUsers, canViewReports }: NavFlags): NavGroup[] {
  return [
    {
      label: "Home",
      items: [
        { href: "/", label: "Dashboard", short: "Home", icon: LayoutDashboard },
        ...(isEmployee
          ? [{ href: "/leaves/new", label: "Apply Leave", short: "Apply", icon: CalendarPlus } as NavItem]
          : []),
        {
          href: "/leaves",
          label: isEmployee ? "My Leave" : "Leave Queue",
          short: "Leave",
          icon: Inbox,
        },
      ],
    },
    ...(canManageUsers || canViewReports
      ? [
          {
            label: "Manage",
            items: [
              ...(canManageUsers ? [{ href: "/users", label: "Users", icon: Users } as NavItem] : []),
              ...(canViewReports
                ? [
                    { href: "/reports", label: "Reports", icon: FileSpreadsheet },
                    { href: "/audit", label: "Audit Log", short: "Audit", icon: FileText },
                  ] as NavItem[]
                : []),
            ],
          } as NavGroup,
        ]
      : []),
    ...(isEmployee
      ? []
      : [
          {
            label: "Settings",
            items: [
              ...(canManageUsers ? [{ href: "/settings", label: "Payroll", icon: Settings2 } as NavItem] : []),
              { href: "/security", label: "Security", icon: Shield },
            ],
          } as NavGroup,
        ]),
  ];
}
