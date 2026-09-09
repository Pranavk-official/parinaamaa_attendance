"use server";

import { revalidatePath } from "next/cache";
import { punchIn, punchOut } from "@/lib/domain/punch";
import { mustUser } from "@/lib/auth/auth-user";
import { isLeaveExempt } from "@/lib/domain/leave-policy";

export async function wfhPunchInAction() {
  const user = await mustUser();
  if (isLeaveExempt(user)) return { error: "Admins do not punch in" };
  const result = await punchIn(user.id, "WFH");
  if (result.alreadyPunched) return { error: "Already punched in today" };
  revalidatePath("/");
  return { ok: true as const, type: result.attendance.type };
}

export async function punchOutAction() {
  const user = await mustUser();
  const result = await punchOut(user.id);
  if (result.error) return { error: result.error };
  revalidatePath("/");
  return {
    ok: true as const,
    compensatoryEarned: result.compensatoryEarned ?? 0,
    halfDay: result.halfDay ?? false,
  };
}