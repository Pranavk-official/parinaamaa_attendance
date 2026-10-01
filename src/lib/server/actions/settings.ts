"use server";

import { revalidatePath } from "next/cache";
import { mustUser, requirePermission } from "@/lib/auth/auth-user";
import { setPayrollDay, setFiscalStart } from "@/lib/domain/settings";
import { fiscalStartToKey, type FiscalStart } from "@/lib/domain/fiscal";
import { prisma } from "@/lib/db/prisma";

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
const HOLIDAY_PATHS = ["/settings", "/"];

export async function saveHolidayAction(input: { date: string; name: string }) {
  const actor = await mustUser();
  requirePermission(actor, "manage:users");

  const name = input.name.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !name) {
    return { error: "Pick a date and give the holiday a name" };
  }
  const date = new Date(`${input.date}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return { error: "Invalid date" };

  // One holiday per date: saving an existing date renames it.
  await prisma.companyHoliday.upsert({
    where: { date },
    create: { date, name },
    update: { name },
  });
  HOLIDAY_PATHS.forEach((p) => revalidatePath(p));
  return { ok: true as const };
}

export async function deleteHolidayAction(id: string) {
  const actor = await mustUser();
  requirePermission(actor, "manage:users");
  await prisma.companyHoliday.deleteMany({ where: { id } });
  HOLIDAY_PATHS.forEach((p) => revalidatePath(p));
  return { ok: true as const };
}
