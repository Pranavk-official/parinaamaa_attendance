// One-run sanity check for fiscal year + leave day math.
import assert from "node:assert";
import { readFileSync } from "node:fs";
import {
  fiscalYear,
  countDays,
  monthsAccrued,
  monthsElapsedInFiscalYear,
  remainingDays,
  unpaidDeduction,
} from "../src/lib/domain/fiscal";
import { compensatoryEarned, leftEarly, resolveLeaveType } from "../src/lib/domain/leave-policy";
import { monthRange, periodRange } from "../src/lib/domain/export-payroll";
import {
  leaveMailBody,
  leaveMailSubject,
  rejectMailBody,
  rejectMailSubject,
} from "../src/lib/domain/leave-mail";
import { activeUserWhere } from "../src/lib/domain/leave-policy";

// April 1 2026 rallies to 2026-2027
assert.equal(fiscalYear(new Date(2026, 3, 1)), "2026-2027");
// Old-style fiscal year on Jan 15 2010 = 2009-2010
const jan = new Date(2010, 0, 15);
assert.equal(fiscalYear(jan), "2009-2010");
// Half day: 1 day -> 0.5
assert.equal(countDays(new Date(2026, 8, 7), new Date(2026, 8, 7), true), 0.5);
// 3 day span -> 3
assert.equal(countDays(new Date(2026, 8, 7), new Date(2026, 8, 9), false), 3);
// A half day never spans a range, so it stays 0.5.
const d = new Date(2026, 8, 7);
assert.equal(countDays(d, d, true), 0.5);

// Annual lump: remaining is allocated minus used.
assert.equal(remainingDays({ allocated: 5, perMonth: 0, used: 1.5 }), 3.5);
// Monthly accrual grows with the fiscal year.
assert.equal(remainingDays({ allocated: 0, perMonth: 1, used: 0 }), monthsElapsedInFiscalYear());
// No balance row means nothing available, so paid leave falls back to unpaid.
assert.equal(remainingDays(null), 0);
// Loss of pay: a 90,000 monthly gross, half a day unpaid, 31-day month.
assert.equal(unpaidDeduction(90000, 0.5, 31), 1451.61);

// Paid days left, so a regular request is taken as paid leave.
assert.equal(resolveLeaveType("REGULAR", 3, 1), "PAID");
// Paid balance short of the request, so paid leave falls back to unpaid.
assert.equal(resolveLeaveType("PAID", 0.5, 1), "REGULAR");
// A half day fits in half a day of balance.
assert.equal(resolveLeaveType("PAID", 0.5, 0.5), "PAID");
// Compensatory is earned separately and never converts.
assert.equal(resolveLeaveType("COMPENSATORY", 0, 1), "COMPENSATORY");

// The mail draft fills in what the form knows and brackets what it does not.
const mail = {
  employeeName: "Dev Patel",
  designation: "Software Engineer",
  type: "PAID",
  startDate: "2026-09-14",
  endDate: "2026-09-16",
  days: 3,
  isHalfDay: false,
  halfDaySession: null,
  reason: "Family function",
};
assert.equal(leaveMailSubject(mail), "Leave request — Dev Patel — 2026-09-14 to 2026-09-16");
assert.ok(leaveMailBody(mail).includes("paid leave on 2026-09-14 to 2026-09-16, totalling 3 days"));
assert.ok(!leaveMailBody(mail).includes("["));
// A single date reads as one day, not a range.
assert.ok(
  leaveMailSubject({ ...mail, endDate: mail.startDate }).endsWith("2026-09-14")
);
// Nothing filled in yet: every gap is a visible placeholder.
const blank = leaveMailBody({ ...mail, employeeName: "", designation: null, startDate: "", endDate: "", days: 0, reason: "" });
for (const p of ["[your name]", "[your designation]", "[dates]", "[number of days]", "[reason for the leave]"]) {
  assert.ok(blank.includes(p), `missing placeholder ${p}`);
}

// The rejection draft leaves the manager one blank to fill in.
const decision = {
  employeeName: "Dev Patel",
  type: "PAID",
  startDate: "2026-09-14",
  endDate: "2026-09-16",
  days: 3,
};
assert.equal(rejectMailSubject(decision), "Leave request declined — 2026-09-14 to 2026-09-16");
assert.ok(rejectMailBody(decision).includes("[reason for declining]"));
assert.ok(rejectMailBody(decision).startsWith("Dear Dev Patel,"));
// A single date reads as one date, not a range.
assert.ok(rejectMailSubject({ ...decision, endDate: decision.startDate }).endsWith("2026-09-14"));

// The import template's header must match the columns the parser reads.
const templateHeader = readFileSync("src/features/users/users-import.tsx", "utf8")
  .match(/"(name,email,[^"]+)"/)?.[1]
  ?.split(",") ?? [];
for (const column of [
  "name",
  "email",
  "password",
  "designation",
  "role",
  "salary",
  "salaryBasis",
  "paidPerMonth",
  "compensatory",
  "joinedDate",
  "relievingDate",
]) {
  assert.ok(templateHeader.includes(column), `template is missing ${column}`);
}

// Working an off day earns compensatory leave by the hours actually worked.
assert.equal(compensatoryEarned(9), 1); // full 09:30-18:30 shift
assert.equal(compensatoryEarned(4.5), 1); // half the shift still rounds up to a day
assert.equal(compensatoryEarned(4.49), 0.5);
assert.equal(compensatoryEarned(0.9), 0); // punched straight back out

// Leaving before the 14:00 session boundary is a half day; after it is not.
assert.equal(leftEarly(new Date(2026, 8, 7, 13, 59)), true);
assert.equal(leftEarly(new Date(2026, 8, 7, 14, 0)), false);
assert.equal(leftEarly(new Date(2026, 8, 7, 18, 30)), false);

// Payroll month [2 Feb, 2 Mar): label is the month key, end stays exclusive.
const feb = monthRange(2, "2026-02");
assert.equal(feb.start.toISOString(), "2026-02-02T00:00:00.000Z");
assert.equal(feb.endExclusive.toISOString(), "2026-03-02T00:00:00.000Z");
// Default (no key) points at the previous calendar month.
const def = monthRange(2);
assert.equal(def.label, def.start.toISOString().slice(0, 7));

// A bare range wins over a month; `to` is inclusive so endExclusive is to+1 day.
const range = periodRange(2, { month: "2026-05", from: "2026-02-07", to: "2026-03-06" });
assert.equal(range.start.toISOString(), "2026-02-07T00:00:00.000Z");
assert.equal(range.endExclusive.toISOString(), "2026-03-07T00:00:00.000Z");
assert.equal(range.label, "2026-02-07-2026-03-06");
// A garbled range falls back to the default month.
assert.equal(periodRange(2, { from: "nope", to: "2026-03-06" }).label, def.label);

// Accrual pro-rate: blank joinedDate means the full fiscal year so far.
// Joined 2026-09-09, today 2026-09-10: September counts once its day arrives.
const sep10 = new Date(2026, 8, 10);
assert.equal(monthsAccrued(sep10, { month: 3, day: 1 }, null), 6);
assert.equal(monthsAccrued(sep10, { month: 3, day: 1 }, new Date(2026, 8, 9)), 1);
assert.equal(monthsAccrued(sep10, { month: 3, day: 1 }, new Date(2026, 8, 10)), 1);
assert.equal(monthsAccrued(sep10, { month: 3, day: 1 }, new Date(2026, 8, 11)), 0);
assert.equal(monthsAccrued(sep10, { month: 3, day: 1 }, new Date(2026, 3, 1)), 6);
assert.equal(
  remainingDays({ allocated: 0, perMonth: 2, used: 0 }, { month: 3, day: 1 }, new Date(2026, 8, 9), sep10),
  2
);

// Inactive staff drop out of dashboards, queues and payroll: blocked always,
// relieved before the reference day. The relieving day itself still counts.
assert.deepEqual(activeUserWhere(new Date(2026, 8, 10)), {
  isBlocked: false,
  OR: [{ relievingDate: null }, { relievingDate: { gte: new Date(Date.UTC(2026, 8, 10)) } }],
});

console.log("fiscal checks passed");