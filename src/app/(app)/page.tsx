import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PunchWidget } from "@/components/punch-widget";
import { DailySplitChart, MonthlyLeaveChart } from "@/components/charts";
import { mustUser } from "@/lib/auth-user";
import { isLeaveExempt } from "@/lib/leave-policy";
import { prisma } from "@/lib/prisma";
import { fiscalYear, monthsElapsedInFiscalYear, toDateOnly, countDays } from "@/lib/fiscal";

function iso(d: Date) {
  return toDateOnly(d).toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const user = await mustUser();
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
      where: {
        userId: user.id,
        date: {
          gte: toDateOnly(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
        },
      },
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

  const monthlyMap = new Map<string, number>();
  for (const l of leaveRequests) {
    const m = l.startDate.toLocaleString("en-US", { month: "short" });
    monthlyMap.set(m, (monthlyMap.get(m) ?? 0) + countDays(l.startDate, l.endDate, l.isHalfDay));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Dashboard <span className="text-base font-normal text-muted-foreground">FY {fy}</span>
        </h1>
        <p className="text-sm text-muted-foreground">{user.designation ?? "Employee"}</p>
      </div>

      {!isLeaveExempt(user) && (
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle className="text-base">
              Today
              {attendance && (
                <Badge variant="secondary" className="ml-2">
                  {attendance.type} {attendance.punchIn.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PunchWidget
              punchedIn={!!attendance}
              punchedOut={!!attendance?.punchOut}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {balances.length === 0 && (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              No leave balances allocated for FY {fy}.
            </CardContent>
          </Card>
        )}
        {balances.map((b) => {
          const entitled =
            b.perMonth > 0 ? b.perMonth * monthsElapsedInFiscalYear() : b.allocated;
          const remaining = entitled - b.used;
          return (
            <Card key={b.leaveType}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  {b.leaveType.replaceAll("_", " ")}
                  {b.perMonth > 0 && <span className="ml-1">· {b.perMonth}/mo</span>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {remaining.toFixed(1)}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}/ {entitled.toFixed(1)} days remaining
                  </span>
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily WFO / WFH split</CardTitle>
          </CardHeader>
          <CardContent>
            <DailySplitChart data={[...dailyMap.values()]} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly leave usage</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyLeaveChart
              data={[...monthlyMap.entries()].map(([month, days]) => ({ month, days }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}