import { NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth-user";
import { collectPayrollRows, payrollToCSV, payrollToXLSX } from "@/lib/export-payroll";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "export:payroll")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  const month = url.searchParams.get("month") ?? undefined;
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const { label, rows } = await collectPayrollRows({ month, from, to });

  if (format === "xlsx") {
    const buffer = await payrollToXLSX(rows);
    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="payroll-${label}.xlsx"`,
      },
    });
  }

  return new Response(payrollToCSV(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payroll-${label}.csv"`,
    },
  });
}