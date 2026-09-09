// Fiscal year runs from the configured start (default: April 1) to the day
// before that date next year. "2026-2027" covers 2026-04-01..2027-03-31.
export type FiscalStart = { month: number; day: number }; // month 0-11, day 1-31

const DEFAULT_FISCAL_START: FiscalStart = { month: 3, day: 1 };

// Stored in DB as "MM-DD"; null when the record would be nonsense.
export function fiscalStartToKey(s: FiscalStart): string | null {
  if (!Number.isInteger(s.month) || s.month < 0 || s.month > 11) return null;
  if (!Number.isInteger(s.day) || s.day < 1 || s.day > 31) return null;
  return `${String(s.month + 1).padStart(2, "0")}-${String(s.day).padStart(2, "0")}`;
}

export function fiscalYear(
  date: Date = new Date(),
  start: FiscalStart = DEFAULT_FISCAL_START
): string {
  const y = date.getFullYear();
  const beganThisYear =
    date.getMonth() > start.month ||
    (date.getMonth() === start.month && date.getDate() >= start.day);
  const sy = beganThisYear ? y : y - 1;
  return `${sy}-${sy + 1}`;
}

// Months of the fiscal year that have begun by `date` (the start month = 1).
export function monthsElapsedInFiscalYear(
  date: Date = new Date(),
  start: FiscalStart = DEFAULT_FISCAL_START
): number {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const sy = m > start.month || (m === start.month && d >= start.day) ? y : y - 1;
  return (y - sy) * 12 + (m - start.month) + (d >= start.day ? 1 : 0);
}

export function fiscalYearRange(
  fy: string,
  start: FiscalStart = DEFAULT_FISCAL_START
): { start: Date; end: Date } {
  const [startY, endY] = fy.split("-").map(Number);
  return {
    start: new Date(Date.UTC(startY, start.month, start.day)),
    end: new Date(Date.UTC(endY, start.month, start.day) - 1), // day before next start
  };
}

export function countDays(start: Date, end: Date, isHalfDay: boolean): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;
  return (isHalfDay ? 0.5 : 1) * Math.max(days, 1);
}

export function toDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

// A payroll month runs [day D of month M, day D of month M+1): the Nth is the
// day salary lands, so the period is the day after the last payout up to the
// next one. D=1 collapses to a plain calendar month.
export function monthRange(day: number, monthKey?: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey ?? "");
  if (m) {
    const y = Number(m[1]);
    const month = Number(m[2]);
    if (month >= 1 && month <= 12) {
      return {
        start: new Date(Date.UTC(y, month - 1, day)),
        endExclusive: new Date(Date.UTC(y, month, day)),
        label: monthKey!,
      };
    }
  }
  const now = new Date();
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, day));
  const endExclusive = new Date(Date.UTC(now.getFullYear(), now.getMonth(), day));
  return { start, endExclusive, label: start.toISOString().slice(0, 7) };
}

export type PayrollPeriod = { month?: string; from?: string; to?: string };

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** A month (shifted by the payroll day), or a bare date range. `to` is inclusive. */
export function periodRange(day: number, period?: PayrollPeriod) {
  const { month, from, to } = period ?? {};
  if (from && to && YMD.test(from) && YMD.test(to)) {
    const start = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T00:00:00.000Z`);
    if (end >= start) {
      // endExclusive must be start+period so daysInMonth counts the right length.
      return {
        start,
        endExclusive: new Date(end.getTime() + 86_400_000),
        label: start.getTime() === end.getTime() ? from : `${from}-${to}`,
      };
    }
  }
  return monthRange(day, month);
}

// Days still available on a balance. A perMonth balance accrues through the
// fiscal year; anything else is an annual lump.
export function remainingDays(
  b: { allocated: number; perMonth: number; used: number } | null | undefined,
  start: FiscalStart = DEFAULT_FISCAL_START
): number {
  if (!b) return 0;
  return b.perMonth > 0
    ? b.perMonth * monthsElapsedInFiscalYear(new Date(), start) - b.used
    : b.allocated - b.used;
}

// Loss of pay follows the common monthly-gross / days-in-month convention.
// Change the divisor here if payroll switches to working days.
export function unpaidDeduction(
  monthlyGross: number,
  unpaidDays: number,
  daysInMonth: number
): number {
  return Math.round((monthlyGross / daysInMonth) * unpaidDays * 100) / 100;
}
