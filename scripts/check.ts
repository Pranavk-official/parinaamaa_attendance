// One-run sanity check for fiscal year + leave day math.
import assert from "node:assert";
import {
  fiscalYear,
  countDays,
  monthsElapsedInFiscalYear,
  remainingDays,
  unpaidDeduction,
} from "../src/lib/fiscal";
import { resolveLeaveType } from "../src/lib/leave-policy";
import {
  leaveMailBody,
  leaveMailSubject,
  rejectMailBody,
  rejectMailSubject,
} from "../src/lib/leave-mail";

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

console.log("fiscal checks passed");