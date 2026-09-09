import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { mustUser } from "@/lib/auth/auth-user";
import { isLeaveExempt } from "@/lib/domain/leave-policy";
import { PageHeader } from "@/features/shell/page-header";
import { LeaveForm } from "@/features/leaves/leave-form";

export const metadata: Metadata = { title: "Apply Leave" };

export default async function NewLeavePage() {
  const user = await mustUser();
  if (isLeaveExempt(user)) redirect("/leaves");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Apply Leave"
        subtitle="Pick your dates, say why, and your manager gets the request."
      />
      <LeaveForm employeeName={user.name} designation={user.designation} />
    </div>
  );
}
