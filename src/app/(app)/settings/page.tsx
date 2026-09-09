import type { Metadata } from "next";
import { mustUser, requirePermission } from "@/lib/auth/auth-user";
import { getPayrollDay, getFiscalStart } from "@/lib/domain/settings";
import { PageHeader } from "@/features/shell/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PayrollSettings } from "@/features/billing/payroll-settings";
import { FiscalYearSettings } from "@/features/shell/fiscal-year-settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await mustUser();
  requirePermission(user, "manage:users");
  const [day, fiscalStart] = await Promise.all([getPayrollDay(), getFiscalStart()]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" subtitle="Payroll windows and the financial year." />
      <Tabs defaultValue="payroll" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="fiscal">Financial year</TabsTrigger>
        </TabsList>
        <TabsContent value="payroll" className="pt-2">
          <PayrollSettings day={day} />
        </TabsContent>
        <TabsContent value="fiscal" className="pt-2">
          <FiscalYearSettings start={fiscalStart} />
        </TabsContent>
      </Tabs>
    </div>
  );
}