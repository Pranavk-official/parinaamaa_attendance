import { NextResponse } from "next/server";
import { collectPayrollRows, payrollToCSV } from "@/lib/domain/export-payroll";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { label, rows } = await collectPayrollRows();
  const csv = payrollToCSV(rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payroll-${label}.csv"`,
    },
  });
}