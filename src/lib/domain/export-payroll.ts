// Pure date-range math lives in fiscal.ts so scripts/check.ts can assert it
// without pulling in the Prisma client; re-exported here for the app.
export { monthRange, periodRange } from "@/lib/domain/fiscal";
import { periodRange, type PayrollPeriod } from "@/lib/domain/fiscal";
import { prisma } from "@/lib/db/prisma";
import { countDays, unpaidDeduction } from "@/lib/domain/fiscal";
import { EMPLOYEE_WHERE, activeUserWhere, isUnpaidLeave } from "@/lib/domain/leave-policy";
import { getPayrollDay } from "@/lib/domain/settings";

export type PayrollRow = {
  name: string;
  email: string;
  employeeId: string;
  designation: string;
  presentDays: number;
  totalHours: number;
  offdayWorkDays: number;
  approvedLeaves: number;
  // REGULAR leave is unpaid, so payroll deducts these days from salary.
  unpaidLeaveDays: number;
  monthlyGross: number | null;
  unpaidDeduction: number | null;
  netPayable: number | null;
  leaveTypes: string;
};

const HEADERS = [
  "name",
  "email",
  "employee_id",
  "designation",
  "present_days",
  "total_hours",
  "offday_work_days",
  "approved_leaves",
  "unpaid_leave_days",
  "monthly_gross",
  "unpaid_deduction",
  "net_payable",
  "leave_types",
];

// One row order for CSV and XLSX, so a new column can never desync the two.
function cells(r: PayrollRow) {
  return [
    r.name,
    r.email,
    r.employeeId,
    r.designation,
    r.presentDays,
    r.totalHours,
    r.offdayWorkDays,
    r.approvedLeaves,
    r.unpaidLeaveDays,
    r.monthlyGross ?? "",
    r.unpaidDeduction ?? "",
    r.netPayable ?? "",
    r.leaveTypes,
  ];
}

function hoursBetween(a: Date, b: Date) {
  return Math.max(0, (b.getTime() - a.getTime()) / (1000 * 60 * 60));
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export async function collectPayrollRows(period?: PayrollPeriod) {
  const { start, endExclusive, label } = periodRange(await getPayrollDay(), period);

  const [users, attendances, leaveRequests] = await Promise.all([
    prisma.user.findMany({
      // Admins and super admins draw no attendance and no leave, so they are
      // not payroll rows. Blocked staff are out entirely; staff relieved
      // mid-period keep the days they worked.
      where: { AND: [EMPLOYEE_WHERE, activeUserWhere(start)] },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        designation: true,
        salary: true,
        salaryBasis: true,
        joinedDate: true,
        relievingDate: true,
      },
    }),
    prisma.attendance.findMany({
      where: { date: { gte: start, lt: endExclusive } },
      orderBy: [{ date: "asc" }],
    }),
    prisma.leaveRequest.findMany({
      where: { status: "APPROVED", startDate: { lt: endExclusive }, endDate: { gte: start } },
    }),
  ]);

  // Salary changes mid-history, so each row is valued at the latest record
  // before the period starts — not at today's salary.
  const history = await prisma.salaryHistory.findMany({
    where: { userId: { in: users.map((u) => u.id) }, createdAt: { lte: start } },
    orderBy: { createdAt: "desc" },
  });
  // History comes back newest first; keep the latest record per user.
  const payAt = new Map<string, (typeof history)[number]>();
  for (const h of history) payAt.set(h.userId, payAt.get(h.userId) ?? h);

  const attendanceByUser = new Map<string, typeof attendances>();
  for (const a of attendances) {
    const list = attendanceByUser.get(a.userId) ?? [];
    list.push(a);
    attendanceByUser.set(a.userId, list);
  }
  const leavesByUser = new Map<string, typeof leaveRequests>();
  for (const l of leaveRequests) {
    const list = leavesByUser.get(l.userId) ?? [];
    list.push(l);
    leavesByUser.set(l.userId, list);
  }

  // Whole period length in days, half-open: [start, endExclusive).
  const daysInMonth = Math.round((endExclusive.getTime() - start.getTime()) / 86_400_000);
  const day = 86_400_000;
  const rows: PayrollRow[] = users.flatMap((u) => {
    const att = attendanceByUser.get(u.id) ?? [];
    const leaves = leavesByUser.get(u.id) ?? [];
    // Staff who joined after the period started (or were relieved before it)
    // have no sheet row — unless they actually have days in the period.
    // activeUserWhere already drops the relieved; the joined check needs the
    // period, so it lives here.
    if (att.length === 0 && leaves.length === 0) {
      if (u.joinedDate && new Date(u.joinedDate) > start) return [];
    }
    const unpaidLeaveDays = leaves.reduce(
      (acc, l) =>
        acc + (isUnpaidLeave(l.type) ? countDays(l.startDate, l.endDate, l.isHalfDay) : 0),
      0
    );
    const h = payAt.get(u.id);
    const salary = h ? h.salary : u.salary;
    const basis = h ? h.basis : u.salaryBasis;
    // Joining/exit months pay only the employed days (relieving day counts).
    const employedFrom = u.joinedDate ? Math.max(start.getTime(), new Date(u.joinedDate).getTime()) : start.getTime();
    const employedTo = u.relievingDate
      ? Math.min(endExclusive.getTime(), new Date(u.relievingDate).getTime() + day)
      : endExclusive.getTime();
    const employedFactor = Math.max(0, employedTo - employedFrom) / day / daysInMonth;
    const monthlyGross =
      salary === null
        ? null
        : (Number(salary) / (basis === "ANNUAL" ? 12 : 1)) * employedFactor;
    const deduction =
      monthlyGross === null
        ? null
        : unpaidDeduction(monthlyGross, unpaidLeaveDays, daysInMonth);
    const totalHours = att.reduce(
      (acc, a) => acc + (a.punchOut ? hoursBetween(a.punchIn, a.punchOut) : 0),
      0
    );
    return {
      name: u.name,
      email: u.email,
      employeeId: u.employeeId ?? "",
      designation: u.designation ?? "",
      presentDays: att.length,
      totalHours: Math.round(totalHours * 100) / 100,
      offdayWorkDays: att.filter((a) => a.type === "OFFDAY_WORK").length,
      approvedLeaves: leaves.reduce(
        (acc, l) => acc + countDays(l.startDate, l.endDate, l.isHalfDay),
        0
      ),
      unpaidLeaveDays,
      monthlyGross: monthlyGross === null ? null : Math.round(monthlyGross * 100) / 100,
      unpaidDeduction: deduction,
      // What payroll actually pays out for the month.
      netPayable:
        monthlyGross === null ? null : Math.round((monthlyGross - (deduction ?? 0)) * 100) / 100,
      leaveTypes: leaves
        .map((l) =>
          l.halfDaySession ? `${l.type} ${l.halfDaySession.toLowerCase()}` : l.type
        )
        .join("|"),
    };
  });

  return { label, rows };
}

export function payrollToCSV(rows: PayrollRow[]): string {
  const header = HEADERS.join(",");
  const body = rows.map((r) => cells(r).map(csvCell).join(","));
  return [header, ...body].join("\n");
}

export async function payrollToXLSX(rows: PayrollRow[]): Promise<ArrayBuffer> {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows.map(cells)]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Payroll");
  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}