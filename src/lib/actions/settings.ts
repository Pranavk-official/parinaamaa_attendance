"use server";

import { revalidatePath } from "next/cache";
import { mustUser, requirePermission } from "@/lib/auth-user";
import { setPayrollDay, setFiscalStart } from "@/lib/settings";
import { fiscalStartToKey, type FiscalStart } from "@/lib/fiscal";

export async function updatePayrollDayAction(day: number) {
  const actor = await mustUser();
  requirePermission(actor, "manage:users");

  if (!Number.isInteger(day) || day < 1 || day > 28) {
    return { error: "Payroll day must be between 1 and 28" };
  }

  await setPayrollDay(day, actor.id);
  revalidatePath("/settings");
  revalidatePath("/reports");
  return { ok: true as const };
}

export async function updateFiscalStartAction(start: FiscalStart) {
  const actor = await mustUser();
  requirePermission(actor, "manage:users");

  if (!fiscalStartToKey(start)) {
    return { error: "Pick a valid month and day for the financial year start" };
  }

  await setFiscalStart(start, actor.id);
  revalidatePath("/settings");
  revalidatePath("/reports");
  revalidatePath("/");
  revalidatePath("/users");
  return { ok: true as const };
}