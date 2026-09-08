import type { Metadata } from "next";
import { mustUser, requirePermission } from "@/lib/auth-user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { ReportExport } from "@/components/report-export";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const user = await mustUser();
  requirePermission(user, "view:reports");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reports"
        subtitle="Month-end exports for payroll, straight from attendance and approved leave."
      />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Payroll export</CardTitle>
          <CardDescription>
            Download the attendance and approved-leave summary for a month as CSV or XLSX.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReportExport />
        </CardContent>
      </Card>
    </div>
  );
}
