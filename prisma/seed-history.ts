import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "./seed-common";

// One-shot history load (users, employee IDs, attendance, leaves, balances,
// salary trail). Runs inside the web boot sequence, guarded by a Setting
// marker so it fires once and never again. Row-safe to re-run: the dump is
// INSERT ... ON CONFLICT DO NOTHING, and pre-existing emails keep prod rows.
const MARKER = "historySeed";
const VERSION = "v1";

// Staff covered by the history dump.
const STAFF_EMAILS = [
  "pranavkcse@gmail.com",
  "naveensureshedkm@gmail.com",
  "harigavind.b@gmail.com",
  "ajalpramod06@gmail.com",
  "prateekrshenoy2003@gmail.com",
  "albin@parinaamaa.ai",
];

export async function seedHistory() {
  const done = await prisma.setting.findUnique({ where: { key: MARKER } });
  if (done) {
    console.log(`history already seeded (${done.value}) — skipping`);
    return;
  }
  if (await prisma.user.count({ where: { employeeId: { not: null } } })) {
    await prisma.setting.create({ data: { key: MARKER, value: VERSION } });
    console.log("employee IDs present — marking seeded, skipping");
    return;
  }
  const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "seed-v2-data.sql"), "utf8");
  // Split on the full terminator: values may contain semicolons/newlines.
  const stmts = [...sql.matchAll(/INSERT INTO .*?ON CONFLICT DO NOTHING;/gs)].map((m) => m[0]);

  // Prod may already hold same-email accounts with different ids (e.g. from
  // seed.prod). A history row pointing at a skipped user would fail its FK,
  // so take over shell accounts — but never touch one that owns data.
  for (const email of STAFF_EMAILS) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) continue;
    const [att, leaves, balances, salaries] = await Promise.all([
      prisma.attendance.count({ where: { userId: existing.id } }),
      prisma.leaveRequest.count({ where: { userId: existing.id } }),
      prisma.leaveBalance.count({ where: { userId: existing.id } }),
      prisma.salaryHistory.count({ where: { userId: existing.id } }),
    ]);
    if (att + leaves + balances + salaries === 0) {
      await prisma.user.delete({ where: { email } });
      console.log(`took over shell account ${email}`);
    } else {
      console.log(`keep prod ${email} (owns data) — history not merged for it`);
    }
  }
  let ok = 0;
  for (const s of stmts) {
    try {
      await prisma.$executeRawUnsafe(s);
      ok++;
    } catch (e) {
      console.log("seed skipped a row:", String(e).split("\n")[0].slice(0, 140));
    }
  }
  await prisma.setting.create({ data: { key: MARKER, value: VERSION } });
  console.log(`history seed done: ${ok}/${stmts.length} statements applied`);
}
