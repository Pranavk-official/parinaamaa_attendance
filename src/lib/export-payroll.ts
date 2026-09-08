import { prisma } from "@/lib/prisma";
import { countDays, unpaidDeduction } from "@/lib/fiscal";
import { EMPLOYEE_WHERE, isUnpaidLeave } from "@/lib/leave-policy";

export type PayrollRow = {
  name: string;
  email: string;
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

// Last complete month by default; accepts "YYYY-MM".
export function monthRange(monthKey?: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey ?? "");
  if (m) {
    const y = Number(m[1]);
    const month = Number(m[2]);
    if (month >= 1 && month <= 12) {
      return {
        start: new Date(Date.UTC(y, month - 1, 1)),
        end: new Date(Date.UTC(y, month, 0, 23, 59, 59)),
        label: monthKey!,
      };
    }
  }
  const now = new Date();
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0, 23, 59, 59));
  return { start, end, label: start.toISOString().slice(0, 7) };
}

export async function collectPayrollRows(monthKey?: string) {
  const { start, end, label } = monthRange(monthKey);

  const [users, attendances, leaveRequests] = await Promise.all([
    prisma.user.findMany({
      // Admins and super admins draw no attendance and no leave, so they are
      // not payroll rows.
      where: EMPLOYEE_WHERE,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        designation: true,
        salary: true,
        salaryBasis: true,
      },
    }),
    prisma.attendance.findMany({
      where: { date: { gte: start, lte: end } },
      orderBy: [{ date: "asc" }],
    }),
    prisma.leaveRequest.findMany({
      where: { status: "APPROVED", startDate: { lte: end }, endDate: { gte: start } },
    }),
  ]);

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

  const daysInMonth = end.getUTCDate();
  const rows: PayrollRow[] = users.map((u) => {
    const att = attendanceByUser.get(u.id) ?? [];
    const leaves = leavesByUser.get(u.id) ?? [];
    const unpaidLeaveDays = leaves.reduce(
      (acc, l) =>
        acc + (isUnpaidLeave(l.type) ? countDays(l.startDate, l.endDate, l.isHalfDay) : 0),
      0
    );
    const monthlyGross =
      u.salary === null
        ? null
        : Number(u.salary) / (u.salaryBasis === "ANNUAL" ? 12 : 1);
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