import { redirect } from "next/navigation";
import { mustUser } from "@/lib/auth-user";
import { isLeaveExempt } from "@/lib/leave-policy";
import { LeaveForm } from "@/components/leave-form";

export default async function NewLeavePage() {
  const user = await mustUser();
  if (isLeaveExempt(user)) redirect("/leaves");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Apply Leave</h1>
      <LeaveForm />
    </div>
  );
}