import type { Metadata } from "next";
import { mustUser, requirePermission } from "@/lib/auth-user";
import { collectPayrollRows } from "@/lib/export-payroll";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ReportExport } from "@/components/report-export";

export const metadata: Metadata = { title: "Reports" };

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Blank rather than ₹0 when no salary is on file: the two mean different things. */
function amount(value: number | null) {
  return value === null ? "—" : money.format(value);
}

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const user = await mustUser();
  requirePermission(user, "view:reports");

  const { month } = await searchParams;
  const { label, rows } = await collectPayrollRows(
    typeof month === "string" ? month : undefined
  );

  const totals = rows.reduce(
    (acc, r) => ({
      unpaidLeaveDays: acc.unpaidLeaveDays + r.unpaidLeaveDays,
      monthlyGross: acc.monthlyGross + (r.monthlyGross ?? 0),
      unpaidDeduction: acc.unpaidDeduction + (r.unpaidDeduction ?? 0),
      netPayable: acc.netPayable + (r.netPayable ?? 0),
    }),
    { unpaidLeaveDays: 0, monthlyGross: 0, unpaidDeduction: 0, netPayable: 0 }
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reports"
        subtitle="Month-end payroll, straight from attendance and approved leave."
      />

      <Card>
        <CardHeader>
          <CardTitle>Payroll export</CardTitle>
          <CardDescription>
            Pick a month to see it below, then download it as CSV or XLSX.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReportExport month={label} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{label}</CardTitle>
          <CardDescription>
            {rows.length} employee{rows.length === 1 ? "" : "s"}. Admins are excluded —
            they record no attendance and draw no leave.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Inbox />
                </EmptyMedia>
                <EmptyTitle>Nothing for this month</EmptyTitle>
                <EmptyDescription>
                  No employee has attendance or approved leave in {label}.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            // Table already wraps itself in a scroll container.
            <Table stacked>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Present</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Offday</TableHead>
                  <TableHead className="text-right">Leave</TableHead>
                  <TableHead className="text-right">Unpaid</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Deduction</TableHead>
                  <TableHead className="text-right">Net payable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.email}>
                    <TableCell data-label="Employee" className="font-medium whitespace-nowrap">
                      {r.name}
                      <span className="block font-normal text-muted-foreground">
                        {r.designation || r.email}
                      </span>
                    </TableCell>
                    <TableCell data-label="Present" className="text-right tabular-nums">{r.presentDays}</TableCell>
                    <TableCell data-label="Hours" className="text-right tabular-nums">{r.totalHours}</TableCell>
                    <TableCell data-label="Offday" className="text-right tabular-nums">{r.offdayWorkDays}</TableCell>
                    <TableCell data-label="Leave" className="text-right tabular-nums">{r.approvedLeaves}</TableCell>
                    <TableCell data-label="Unpaid" className="text-right tabular-nums">
                      {r.unpaidLeaveDays || "—"}
                    </TableCell>
                    <TableCell data-label="Gross" className="text-right tabular-nums whitespace-nowrap">
                      {amount(r.monthlyGross)}
                    </TableCell>
                    <TableCell
                      data-label="Deduction"
                      className={`text-right tabular-nums whitespace-nowrap ${
                        r.unpaidDeduction ? "text-destructive" : ""
                      }`}
                    >
                      {r.unpaidDeduction ? `- ${money.format(r.unpaidDeduction)}` : "—"}
                    </TableCell>
                    <TableCell data-label="Net payable" className="text-right font-medium tabular-nums whitespace-nowrap">
                      {amount(r.netPayable)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-medium">
                  <TableCell>Total</TableCell>
                  <TableCell colSpan={4} />
                  <TableCell data-label="Unpaid" className="text-right tabular-nums">
                    {totals.unpaidLeaveDays || "—"}
                  </TableCell>
                  <TableCell data-label="Gross" className="text-right tabular-nums whitespace-nowrap">
                    {money.format(totals.monthlyGross)}
                  </TableCell>
                  <TableCell data-label="Deduction" className="text-right tabular-nums whitespace-nowrap text-destructive">
                    {totals.unpaidDeduction ? `- ${money.format(totals.unpaidDeduction)}` : "—"}
                  </TableCell>
                  <TableCell data-label="Net payable" className="text-right tabular-nums whitespace-nowrap">
                    {money.format(totals.netPayable)}
                  </TableCell>
                </TableRow>
              </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
