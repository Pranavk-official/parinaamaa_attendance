import type { Metadata } from "next";
import { mustUser, requirePermission } from "@/lib/auth/auth-user";
import { getPayrollDay, getFiscalStart, getHolidays } from "@/lib/domain/settings";
import { toDateOnly } from "@/lib/domain/fiscal";
import { PageHeader } from "@/features/shell/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PayrollSettings } from "@/features/billing/payroll-settings";
import { FiscalYearSettings } from "@/features/shell/fiscal-year-settings";
import { HolidaySettings } from "@/features/shell/holiday-calendar";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await mustUser();
  requirePermission(user, "manage:users");
  const [day, fiscalStart, holidays] = await Promise.all([
    getPayrollDay(),
    getFiscalStart(),
    getHolidays(),
  ]);
  const today = toDateOnly(new Date()).toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" subtitle="Payroll windows, the financial year and holidays." />
      <Tabs defaultValue="payroll" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="fiscal">Financial year</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
        </TabsList>
        <TabsContent value="payroll" className="pt-2">
          <PayrollSettings day={day} />
        </TabsContent>
        <TabsContent value="fiscal" className="pt-2">
          <FiscalYearSettings start={fiscalStart} />
        </TabsContent>
        <TabsContent value="holidays" className="pt-2">
          <HolidaySettings holidays={holidays} today={today} />
        </TabsContent>
      </Tabs>
    </div>
  );
}