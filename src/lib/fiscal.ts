// Fiscal year runs April 1 - March 31. "2026-2027" covers 2026-04-01..2027-03-31.
export function fiscalYear(date: Date = new Date()): string {
  const y = date.getFullYear();
  return date.getMonth() >= 3 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

// Months of the fiscal year that have begun by `date` (April=1 ... March=12).
export function monthsElapsedInFiscalYear(date: Date = new Date()): number {
  return ((date.getMonth() - 3 + 12) % 12) + 1;
}

export function fiscalYearRange(fy: string): { start: Date; end: Date } {
  const [startY] = fy.split("-").map(Number);
  return {
    start: new Date(Date.UTC(startY, 3, 1)), // April 1
    end: new Date(Date.UTC(startY + 1, 2, 31, 23, 59, 59)), // March 31
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

// Days still available on a balance. A perMonth balance accrues through the
// fiscal year; anything else is an annual lump.
export function remainingDays(
  b: { allocated: number; perMonth: number; used: number } | null | undefined
): number {
  if (!b) return 0;
  return b.perMonth > 0
    ? b.perMonth * monthsElapsedInFiscalYear() - b.used
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
