import Link from "next/link";
import {
  CalendarCheck,
  CalendarClock,
  CalendarX,
  ClipboardCheck,
  Clock,
  Inbox,
  UserCheck,
  Users,
} from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/features/shell/page-header";
import { PunchWidget } from "@/features/attendance/punch-widget";
import { DailySplitChart, MonthlyLeaveChart } from "@/features/billing/charts";
import { DayCalendar } from "@/features/shell/holiday-calendar";
import { dayMarks } from "@/lib/domain/day-marks";
import { mustUser, type CurrentUser } from "@/lib/auth/auth-user";
import {
  ALLOCATABLE_LEAVE_TYPES,
  EMPLOYEE_WHERE,
  activeUserWhere,
  isLeaveExempt,
  isUnpaidLeave,
} from "@/lib/domain/leave-policy";
import { prisma } from "@/lib/db/prisma";
import { getFiscalStart, getHolidays } from "@/lib/domain/settings";
import { fiscalYear, remainingDays, toDateOnly, countDays } from "@/lib/domain/fiscal";

function iso(d: Date) {
  return toDateOnly(d).toISOString().slice(0, 10);
}

function time(d: Date) {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

/**
 * Approved leave days per calendar month, oldest first. Keying by year keeps
 * two years' Januarys apart; the year only reaches the label when the series
 * actually spans more than one.
 */
function monthlyLeaveSeries(
  leaves: { startDate: Date; endDate: Date; isHalfDay: boolean }[]
) {
  const byMonth = new Map<string, number>();
  for (const l of leaves) {
    const key = `${l.startDate.getFullYear()}-${String(l.startDate.getMonth() + 1).padStart(2, "0")}`;
    byMonth.set(key, (byMonth.get(key) ?? 0) + countDays(l.startDate, l.endDate, l.isHalfDay));
  }
  const keys = [...byMonth.keys()].sort();
  const multiYear = new Set(keys.map((k) => k.slice(0, 4))).size > 1;
  return keys.map((key) => {
    const [year, month] = key.split("-").map(Number);
    const label = new Date(year, month - 1, 1).toLocaleString("en-US", { month: "short" });
    return {
      month: multiYear ? `${label} '${String(year).slice(2)}` : label,
      days: byMonth.get(key) ?? 0,
    };
  });
}


type Stat = {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof Users;
  /** 0-100: a thin bar under the value, repeating it visually. */
  pct?: number;
};

/** Key numbers in one card: large value, small muted label, hairline dividers. */
function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <Card className="gap-0 py-0">
      <dl
        className={
          stats.length === 3
            ? "grid grid-cols-3 gap-px bg-border"
            : "grid grid-cols-2 gap-px bg-border lg:grid-cols-4"
        }
      >
        {stats.map(({ label, value, hint, icon: Icon, pct }) => (
          <div key={label} className="flex min-w-0 flex-col gap-1 bg-card p-3 sm:p-4">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </dt>
            <dd className="text-xl font-semibold tabular-nums sm:text-2xl">{value}</dd>
            {hint && <dd className="truncate text-xs text-muted-foreground">{hint}</dd>}
            {pct !== undefined && (
              <dd aria-hidden className="mt-1 h-1 bg-muted">
                <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
              </dd>
            )}
          </div>
        ))}
      </dl>
    </Card>
  );
}

export default async function DashboardPage() {
  const user = await mustUser();
  return isLeaveExempt(user) ? <AdminDashboard user={user} /> : <EmployeeDashboard user={user} />;
}

async function AdminDashboard({ user }: { user: CurrentUser }) {
  const start = await getFiscalStart();
  const fy = fiscalYear(new Date(), start);
  const today = toDateOnly(new Date());
  const active = activeUserWhere(today);

  const [
    employeeCount,
    todayAttendance,
    pendingRequests,
    pendingCount,
    approvedThisYear,
    onLeaveToday,
    holidays,
  ] = await Promise.all([
      prisma.user.count({ where: { AND: [EMPLOYEE_WHERE, active] } }),
      prisma.attendance.findMany({
        where: { date: today, user: active },
        include: { user: { select: { name: true, designation: true } } },
        orderBy: { punchIn: "asc" },
      }),
      prisma.leaveRequest.findMany({
        where: { status: "PENDING", user: active },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
        take: 8,
      }),
      // The list above is capped for display; the stat card needs the real total.
      prisma.leaveRequest.count({ where: { status: "PENDING", user: active } }),
      prisma.leaveRequest.findMany({
        where: { status: "APPROVED", user: active },
        select: { type: true, startDate: true, endDate: true, isHalfDay: true },
      }),
      prisma.leaveRequest.count({
        where: { status: "APPROVED", startDate: { lte: today }, endDate: { gte: today }, user: active },
      }),
      getHolidays(),
    ]);

  const todaySplit = todayAttendance.reduce(
    (acc, a) => ({ ...acc, [a.type]: acc[a.type] + 1 }),
    { WFO: 0, WFH: 0, OFFDAY_WORK: 0 }
  );


  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          <>
            Organisation{" "}
            <span className="text-base font-normal text-muted-foreground">FY {fy}</span>
          </>
        }
        subtitle={`${user.designation ?? user.role?.name ?? "Administrator"} · ${today.toUTCString().slice(0, 16)}`}
      />

      <StatStrip
        stats={[
          { label: "Employees", value: employeeCount, icon: Users },
          { label: "Present today", value: todayAttendance.length, hint: `of ${employeeCount}`, icon: UserCheck },
          { label: "On leave today", value: onLeaveToday, icon: CalendarX },
          { label: "Pending requests", value: pendingCount, icon: Inbox },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Attendance today</CardTitle>
            <CardDescription>{today.toUTCString().slice(0, 16)}</CardDescription>
          </CardHeader>
          <CardContent>
            {todayAttendance.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Clock />
                  </EmptyMedia>
                  <EmptyTitle>No punches yet</EmptyTitle>
                  <EmptyDescription>Nobody has punched in today.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table stacked>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">In</TableHead>
                    <TableHead className="text-right">Out</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayAttendance.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell data-label="Employee" className="font-medium">
                        {a.user.name}
                        {a.user.designation && (
                          <span className="ml-2 hidden font-normal text-muted-foreground sm:inline">
                            {a.user.designation}
                          </span>
                        )}
                      </TableCell>
                      <TableCell data-label="Type">
                        <Badge variant="secondary">{a.type.replaceAll("_", " ")}</Badge>
                      </TableCell>
                      <TableCell data-label="In" className="text-right tabular-nums">
                        {time(a.punchIn)}
                      </TableCell>
                      <TableCell
                        data-label="Out"
                        className="text-right tabular-nums text-muted-foreground"
                      >
                        {a.punchOut ? time(a.punchOut) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pending leave requests</CardTitle>
            <CardAction>
              <Button variant="outline" size="sm" render={<Link href="/leaves" />}>
                Open queue
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {pendingRequests.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ClipboardCheck />
                  </EmptyMedia>
                  <EmptyTitle>Queue is clear</EmptyTitle>
                  <EmptyDescription>Nothing is waiting for approval.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table stacked>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="hidden sm:table-cell">Dates</TableHead>
                    <TableHead className="text-right">Days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell data-label="Employee" className="font-medium">
                        {r.user.name}
                      </TableCell>
                      <TableCell data-label="Type">
                        <Badge variant="secondary">{r.type.replaceAll("_", " ")}</Badge>
                      </TableCell>
                      <TableCell
                        data-label="Dates"
                        className="hidden text-muted-foreground sm:table-cell"
                      >
                        {iso(r.startDate)} → {iso(r.endDate)}
                      </TableCell>
                      <TableCell data-label="Days" className="text-right tabular-nums">
                        {countDays(r.startDate, r.endDate, r.isHalfDay).toFixed(1)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s WFO / WFH split</CardTitle>
            <CardDescription>Where the team is working right now.</CardDescription>
          </CardHeader>
          <CardContent>
            <DailySplitChart data={[{ date: iso(today), ...todaySplit }]} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Monthly leave usage</CardTitle>
            <CardDescription>Approved leave days across all staff, FY {fy}.</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyLeaveChart data={monthlyLeaveSeries(approvedThisYear)} />
          </CardContent>
        </Card>
      </div>

      <DayCalendar holidays={holidays} today={iso(today)} />
    </div>
  );
}

async function EmployeeDashboard({ user }: { user: CurrentUser }) {
  const start = await getFiscalStart();
  const fy = fiscalYear(new Date(), start);
  const today = toDateOnly(new Date());
  const yearStart = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));

  const [balances, attendance, yearAttendance, leaveRequests, holidays] = await Promise.all([
    prisma.leaveBalance.findMany({
      where: { userId: user.id, fiscalYear: fy },
      orderBy: { leaveType: "asc" },
    }),
    prisma.attendance.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
    }),
    // The calendar walks this year; the holiday list shares the same window.
    prisma.attendance.findMany({
      where: { userId: user.id, date: { gte: yearStart } },
      select: { date: true, type: true, punchIn: true, punchOut: true },
    }),
    prisma.leaveRequest.findMany({
      where: { userId: user.id, status: { not: "REJECTED" } },
      select: {
        type: true,
        status: true,
        startDate: true,
        endDate: true,
        isHalfDay: true,
        halfDaySession: true,
      },
    }),
    getHolidays(),
  ]);
  const approved = leaveRequests.filter((l) => l.status === "APPROVED");

  const balance = (leaveType: (typeof ALLOCATABLE_LEAVE_TYPES)[number]) => {
    const b = balances.find((x) => x.leaveType === leaveType);
    const row = { allocated: b?.allocated ?? 0, perMonth: b?.perMonth ?? 0, used: b?.used ?? 0 };
    const remaining = remainingDays(row, start, user.joinedDate);
    const entitled = remaining + row.used;
    return {
      value: remaining.toFixed(1),
      hint: `of ${entitled.toFixed(1)} left`,
      pct: entitled > 0 ? Math.min(100, Math.max(0, (remaining / entitled) * 100)) : 0,
    };
  };
  const unpaidDaysTaken = approved.reduce(
    (acc, l) =>
      acc + (isUnpaidLeave(l.type) ? countDays(l.startDate, l.endDate, l.isHalfDay) : 0),
    0
  );

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader
        title={
          <>
            Dashboard{" "}
            <span className="text-base font-normal text-muted-foreground">FY {fy}</span>
          </>
        }
        subtitle={`${user.designation ?? "Employee"} · ${today.toUTCString().slice(0, 16)}`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Today</CardTitle>
          <CardAction>
            {attendance ? (
              <Badge variant="secondary">
                {attendance.type.replaceAll("_", " ")} · {time(attendance.punchIn)}
                {attendance.punchOut && ` – ${time(attendance.punchOut)}`}
              </Badge>
            ) : (
              <Badge variant="outline">Not punched in</Badge>
            )}
          </CardAction>
        </CardHeader>
        <CardContent>
          <PunchWidget type={attendance?.type ?? null} punchedOut={!!attendance?.punchOut} />
        </CardContent>
      </Card>

      {/* Paid and compensatory always show, allocated or not, so an employee can
          see at a glance whether any is available. Unpaid is uncapped: days taken. */}
      <StatStrip
        stats={[
          { label: "Paid leave", icon: CalendarCheck, ...balance("PAID") },
          { label: "Comp off", icon: CalendarClock, ...balance("COMPENSATORY") },
          { label: "Unpaid", icon: CalendarX, value: unpaidDaysTaken.toFixed(1), hint: "days taken" },
        ]}
      />

      <DayCalendar
        title="My calendar"
        description="Attendance, leave and holidays. Tap a day for details."
        holidays={holidays}
        today={iso(today)}
        marks={dayMarks(yearAttendance, leaveRequests)}
      />

      <Card>
        <CardHeader>
          <CardTitle>Monthly leave usage</CardTitle>
          <CardDescription>Approved leave days, FY {fy}.</CardDescription>
        </CardHeader>
        <CardContent>
          <MonthlyLeaveChart data={monthlyLeaveSeries(approved)} />
        </CardContent>
      </Card>
    </div>
  );
}
