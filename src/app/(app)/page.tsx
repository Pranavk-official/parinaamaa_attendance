import Link from "next/link";
import {
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
import { PageHeader } from "@/components/page-header";
import { PunchWidget } from "@/components/punch-widget";
import { DailySplitChart, MonthlyLeaveChart } from "@/components/charts";
import { mustUser, type CurrentUser } from "@/lib/auth-user";
import {
  ALLOCATABLE_LEAVE_TYPES,
  EMPLOYEE_WHERE,
  isLeaveExempt,
  isUnpaidLeave,
} from "@/lib/leave-policy";
import { prisma } from "@/lib/prisma";
import { fiscalYear, monthsElapsedInFiscalYear, toDateOnly, countDays } from "@/lib/fiscal";

function iso(d: Date) {
  return toDateOnly(d).toISOString().slice(0, 10);
}

function time(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

function monthStart() {
  const now = new Date();
  return toDateOnly(new Date(now.getFullYear(), now.getMonth(), 1));
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: number;
  hint?: string;
  icon: typeof Users;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground">{label}</CardTitle>
        <CardAction>
          <Icon className="size-4 text-muted-foreground" aria-hidden />
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">
          {value}
          {hint && <span className="text-sm font-normal text-muted-foreground"> {hint}</span>}
        </p>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const user = await mustUser();
  return isLeaveExempt(user) ? <AdminDashboard user={user} /> : <EmployeeDashboard user={user} />;
}

async function AdminDashboard({ user }: { user: CurrentUser }) {
  const today = toDateOnly(new Date());

  const [
    employeeCount,
    todayAttendance,
    pendingRequests,
    pendingCount,
    approvedThisYear,
    onLeaveToday,
  ] = await Promise.all([
      prisma.user.count({ where: EMPLOYEE_WHERE }),
      prisma.attendance.findMany({
        where: { date: today },
        include: { user: { select: { name: true, designation: true } } },
        orderBy: { punchIn: "asc" },
      }),
      prisma.leaveRequest.findMany({
        where: { status: "PENDING" },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
        take: 8,
      }),
      // The list above is capped for display; the stat card needs the real total.
      prisma.leaveRequest.count({ where: { status: "PENDING" } }),
      prisma.leaveRequest.findMany({
        where: { status: "APPROVED" },
        select: { type: true, startDate: true, endDate: true, isHalfDay: true },
      }),
      prisma.leaveRequest.count({
        where: { status: "APPROVED", startDate: { lte: today }, endDate: { gte: today } },
      }),
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
            <span className="text-base font-normal text-muted-foreground">FY {fiscalYear()}</span>
          </>
        }
        subtitle={`${user.designation ?? user.role?.name ?? "Administrator"} · ${today.toDateString()}`}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Employees" value={employeeCount} icon={Users} />
        <StatCard
          label="Present today"
          value={todayAttendance.length}
          hint={`of ${employeeCount}`}
          icon={UserCheck}
        />
        <StatCard label="On leave today" value={onLeaveToday} icon={CalendarX} />
        <StatCard label="Pending requests" value={pendingCount} icon={Inbox} />
      </div>

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
            <CardDescription>Approved leave days across all staff, FY {fiscalYear()}.</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyLeaveChart data={monthlyLeaveSeries(approvedThisYear)} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance today</CardTitle>
          <CardDescription>{today.toDateString()}</CardDescription>
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
    </div>
  );
}

async function EmployeeDashboard({ user }: { user: CurrentUser }) {
  const fy = fiscalYear();
  const today = toDateOnly(new Date());

  const [balances, attendance, monthAttendance, leaveRequests] = await Promise.all([
    prisma.leaveBalance.findMany({
      where: { userId: user.id, fiscalYear: fy },
      orderBy: { leaveType: "asc" },
    }),
    prisma.attendance.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
    }),
    prisma.attendance.findMany({
      where: { userId: user.id, date: { gte: monthStart() } },
      orderBy: { date: "asc" },
    }),
    prisma.leaveRequest.findMany({
      where: { userId: user.id, status: "APPROVED" },
      select: { type: true, startDate: true, endDate: true, isHalfDay: true },
    }),
  ]);

  const dailyMap = new Map<string, { date: string; WFO: number; WFH: number; OFFDAY_WORK: number }>();
  for (const a of monthAttendance) {
    const key = iso(a.date);
    const row = dailyMap.get(key) ?? { date: key, WFO: 0, WFH: 0, OFFDAY_WORK: 0 };
    row[a.type] += 1;
    dailyMap.set(key, row);
  }

  // Paid and compensatory always get a card, allocated or not, so an employee
  // can see at a glance whether any is available. Regular leave has no card
  // because it is unpaid and uncapped.
  const balanceCards = ALLOCATABLE_LEAVE_TYPES.map((leaveType) => {
    const b = balances.find((x) => x.leaveType === leaveType);
    return {
      leaveType,
      allocated: b?.allocated ?? 0,
      perMonth: b?.perMonth ?? 0,
      used: b?.used ?? 0,
    };
  });

  const unpaidDaysTaken = leaveRequests.reduce(
    (acc, l) =>
      acc + (isUnpaidLeave(l.type) ? countDays(l.startDate, l.endDate, l.isHalfDay) : 0),
    0
  );


  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          <>
            Dashboard{" "}
            <span className="text-base font-normal text-muted-foreground">FY {fy}</span>
          </>
        }
        subtitle={`${user.designation ?? "Employee"} · ${today.toDateString()}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="sm:col-span-2 lg:col-span-3">
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

        <Card>
          <CardHeader>
            <CardTitle className="font-normal text-muted-foreground">REGULAR</CardTitle>
            <CardAction>
              <Badge variant="outline">Unpaid</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-2xl font-semibold tabular-nums">
              {unpaidDaysTaken.toFixed(1)}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}days taken, FY {fy}
              </span>
            </p>
          </CardContent>
        </Card>
        {balanceCards.map((b) => {
          const entitled =
            b.perMonth > 0 ? b.perMonth * monthsElapsedInFiscalYear() : b.allocated;
          const remaining = entitled - b.used;
          const pct = entitled > 0 ? Math.min(100, Math.max(0, (remaining / entitled) * 100)) : 0;
          return (
            <Card key={b.leaveType}>
              <CardHeader>
                <CardTitle className="font-normal text-muted-foreground">
                  {b.leaveType.replaceAll("_", " ")}
                  {b.perMonth > 0 && <span className="ml-1">· {b.perMonth}/mo</span>}
                </CardTitle>
                <CardAction>
                  <Badge variant={remaining > 0 ? "secondary" : "outline"}>
                    {remaining > 0 ? "Available" : "None left"}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <p className="text-2xl font-semibold tabular-nums">
                  {remaining.toFixed(1)}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}/ {entitled.toFixed(1)} days left
                  </span>
                </p>
                {/* Bar repeats the numbers above, so it needs no label of its own. */}
                <div className="h-1.5 w-full bg-muted" aria-hidden>
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily WFO / WFH split</CardTitle>
            <CardDescription>Your punches so far this month.</CardDescription>
          </CardHeader>
          <CardContent>
            <DailySplitChart data={[...dailyMap.values()]} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Monthly leave usage</CardTitle>
            <CardDescription>Approved leave days, FY {fy}.</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyLeaveChart data={monthlyLeaveSeries(leaveRequests)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
