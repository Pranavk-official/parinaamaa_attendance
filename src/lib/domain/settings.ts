import { cache } from "react";
import { prisma, prismaWithAudit } from "@/lib/db/prisma";
import { fiscalStartToKey, type FiscalStart } from "@/lib/domain/fiscal";

// Salary month runs from the Nth of month M to the day before N of month M+1.
// N=1 is a plain calendar month; N=2 is the "paid on the 2nd" cycle.
const DEFAULT_PAYROLL_DAY = 2;
const KEY = "payrollDay";

export const getPayrollDay = cache(async (): Promise<number> => {
  const s = await prisma.setting.findUnique({ where: { key: KEY } });
  const v = Number(s?.value);
  return Number.isInteger(v) && v >= 1 && v <= 28 ? v : DEFAULT_PAYROLL_DAY;
});

export async function setPayrollDay(day: number, actorId: string) {
  await prismaWithAudit(actorId).setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: String(day) },
    update: { value: String(day) },
  });
}

// Financial year start, "MM-DD", defaulting to April 1.
const DEFAULT_FISCAL_START: FiscalStart = { month: 3, day: 1 };
const FISCAL_KEY = "fiscalStart";

export const getFiscalStart = cache(async (): Promise<FiscalStart> => {
  const s = await prisma.setting.findUnique({ where: { key: FISCAL_KEY } });
  const [month, day] = (s?.value ?? "").split("-").map(Number);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31
    ? { month: month - 1, day }
    : DEFAULT_FISCAL_START;
});

export async function setFiscalStart(start: FiscalStart, actorId: string) {
  const key = fiscalStartToKey(start);
  if (!key) return;
  await prismaWithAudit(actorId).setting.upsert({
    where: { key: FISCAL_KEY },
    create: { key: FISCAL_KEY, value: key },
    update: { value: key },
  });
}