// One-run sanity check for fiscal year + leave day math.
import assert from "node:assert";
import { fiscalYear, countDays } from "../src/lib/fiscal";

// April 1 2026 rallies to 2026-2027
assert.equal(fiscalYear(new Date(2026, 3, 1)), "2026-2027");
// Old-style fiscal year on Jan 15 2010 = 2009-2010
const jan = new Date(2010, 0, 15);
assert.equal(fiscalYear(jan), "2009-2010");
// Half day: 1 day -> 0.5
assert.equal(countDays(new Date(2026, 8, 7), new Date(2026, 8, 7), true), 0.5);
// 3 day span -> 3
assert.equal(countDays(new Date(2026, 8, 7), new Date(2026, 8, 9), false), 3);
console.log("fiscal checks passed");