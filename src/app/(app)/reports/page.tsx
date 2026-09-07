import { mustUser, requirePermission } from "@/lib/auth-user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportExport } from "@/components/report-export";

export default async function ReportsPage() {
  const user = await mustUser();
  requirePermission(user, "view:reports");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payroll export</CardTitle>
          <CardDescription>
            Download attendance + approved leave summary for a month as CSV or XLSX.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReportExport />
        </CardContent>
      </Card>
    </div>
  );
}