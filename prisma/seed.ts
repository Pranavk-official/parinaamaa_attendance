// Local dummy data: fake staff with a full fiscal year of invented attendance
// and leave. Never run this against production — use prisma/seed.prod.ts.
import { ROLES, ensureUser, prisma, run, upsertRoles, type SeedUser } from "./seed-common";
import { fiscalYear } from "../src/lib/domain/fiscal";

// Only employees carry leave balances; admins/super admins are exempt.
const USERS: SeedUser[] = [
  { name: "System Admin", email: "admin@company.local", password: "admin123", designation: "Super Admin", role: "Super Admin", isSuperAdmin: true },
  { name: "Arjun Mehta", email: "arjun@company.local", password: "emp12345", designation: "Managing Director", role: "Super Admin", isSuperAdmin: true, salary: 3600000, salaryBasis: "ANNUAL" },
  { name: "Riya Sharma", email: "riya@company.local", password: "emp12345", designation: "Senior HR Manager", role: "Admin", salary: 95000 },
  { name: "Sana Khan", email: "sana@company.local", password: "emp12345", designation: "Accountant", role: "Admin", salary: 70000 },
  { name: "Dev Patel", email: "dev@company.local", password: "emp12345", designation: "Software Engineer", role: "Employee", paidPerMonth: 1, compensatory: 2, salary: 85000 },
  { name: "Meera Iyer", email: "meera@company.local", password: "emp12345", designation: "UX Designer", role: "Employee", paidPerMonth: 1, salary: 78000 },
  { name: "Kabir Singh", email: "kabir@company.local", password: "emp12345", designation: "Software Engineer", role: "Employee", paidPerMonth: 1, salary: 1080000, salaryBasis: "ANNUAL" },
] as const;

function dateOnly(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function at(d: Date, hour: number, minute: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute);
}

// Deterministic PRNG so every seed run produces the same realistic story.
function rng(seed: number) {
  let s = (seed + 1) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// nth (1-based) Sunday of a month, or null if there isn't one.
function nthSunday(year: number, month: number, nth: number) {
  const first = new Date(year, month, 1);
  const firstSunday = (7 - first.getDay()) % 7;
  const day = 1 + firstSunday + (nth - 1) * 7;
  const d = new Date(year, month, day);
  return d.getMonth() === month ? dateOnly(d) : null;
}

async function seedAttendanceFor(userId: string, profile: { wfhBias: number; lateBias: number; otBias: number }, rand: () => number) {
  const fy = fiscalYear();
  const startYear = Number(fy.split("-")[0]);
  const fyStart = new Date(startYear, 3, 1); // Apr 1
  const today = dateOnly(new Date());

  for (let d = new Date(fyStart); d <= today; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0) continue;
    const date = dateOnly(d);
    const wfh = rand() < profile.wfhBias;
    const punchIn = at(
      date,
      wfh ? 9 : 9,
      wfh
        ? Math.round(1 + rand() * 14) // 9:01–9:15 for WFH (no commute)
        : rand() < profile.lateBias
          ? Math.round(60 + rand() * 30) // 10:00–10:30 late arrival
          : Math.round(25 + rand() * 20) // 9:25–9:45 office
    );
    const punchOut = at(
      date,
      rand() < profile.otBias ? 19 + Math.round(rand() * 2) : wfh ? 18 : 18,
      rand() < profile.otBias ? Math.round(rand() * 60) : Math.round(10 + rand() * 25)
    );
    await prisma.attendance.create({
      data: { userId, date, punchIn, punchOut, type: wfh ? "WFH" : "WFO" },
    });
  }

  // Occasional weekend/prod-support work, not every month.
  const offdayMonth = rand() < 0.5 ? 1 : 2; // months back
  const off = nthSunday(
    today.getFullYear(),
    today.getMonth() - offdayMonth,
    2
  );
  if (off && off < today) {
    await prisma.attendance.create({
      data: {
        userId,
        date: off,
        punchIn: at(off, 10, 30),
        punchOut: at(off, 14, 0),
        type: "OFFDAY_WORK",
      },
    });
  }
}

type LeaveSeed = {
  type: "PAID" | "REGULAR" | "COMPENSATORY";
  status: "APPROVED" | "REJECTED" | "PENDING";
  monthsAgo?: number; // start lands N months before the current one
  futureDays?: number; // or N days in the future (planned leave)
  days?: number;
  isHalfDay?: boolean;
  halfDaySession?: "MORNING" | "AFTERNOON";
  reason: string;
};

async function seedLeavesFor(userId: string, scenarios: LeaveSeed[], rand: () => number) {
  const today = dateOnly(new Date());
  for (const s of scenarios) {
    let start: Date;
    if (s.futureDays != null) {
      start = at(new Date(today.getTime() + s.futureDays * 864e5), 0, 0);
    } else {
      const m = s.monthsAgo ?? 0;
      const first = new Date(today.getFullYear(), today.getMonth() - m, 1);
      const day = 3 + Math.floor(rand() * 18); // 3–20
      start = new Date(first.getFullYear(), first.getMonth(), day);
    }
    if (start.getDay() === 6) start.setDate(start.getDate() + 2); // avoid Sat
    if (start.getDay() === 0) start.setDate(start.getDate() + 1); // avoid Sun
    start = dateOnly(start);

    const end = new Date(start.getTime());
    end.setDate(end.getDate() + (s.days ?? 1) - 1);

    await prisma.leaveRequest.create({
      data: {
        userId,
        type: s.type,
        startDate: start,
        endDate: dateOnly(end),
        isHalfDay: s.isHalfDay ?? false,
        halfDaySession: (s.halfDaySession as never) ?? null,
        reason: s.reason,
        status: s.status as never,
        createdAt: s.futureDays != null ? today : at(start, 0, 0).setHours(0, 0, 0, 0) <= today.getTime()
          ? new Date(start.getTime() - (1 + Math.floor(rand() * 6)) * 864e5)
          : today,
      },
    });
  }
}

// Dummy data for the whole fiscal year (Apr 1 → today). One believable history
// per employee, deterministic per run. Wipes their rows first so re-runs stay clean.
async function seedDummyData(userId: string, seedOffset: number) {
  await prisma.attendance.deleteMany({ where: { userId } });
  await prisma.leaveRequest.deleteMany({ where: { userId } });

  const rand = rng(seedOffset);
  const fy = fiscalYear();

  // Per-employee work profiles: office-first, hybrid, and flexible.
  if (seedOffset === 0) {
    // Dev: office-first, occasional OT, one trip + a sick morning + pending casual.
    await seedAttendanceFor(userId, { wfhBias: 0.1, lateBias: 0.03, otBias: 0.1 }, () => rand());
    await seedLeavesFor(userId, [
      { type: "PAID", status: "APPROVED", monthsAgo: 3, days: 3, reason: "Family trip to Goa" },
      { type: "PAID", status: "APPROVED", monthsAgo: 2, days: 2, reason: "Wedding in Pune" },
      { type: "PAID", status: "APPROVED", monthsAgo: 1, isHalfDay: true, halfDaySession: "MORNING", reason: "Fever, doctor in the morning" },
      { type: "REGULAR", status: "PENDING", futureDays: 5, days: 1, reason: "Personal errand" },
    ], () => rand());
  } else if (seedOffset === 1) {
    // Meera: hybrid, bridge-weekend trip, a comp-off for weekend work, half afternoons.
    await seedAttendanceFor(userId, { wfhBias: 0.5, lateBias: 0, otBias: 0.02 }, () => rand());
    await seedLeavesFor(userId, [
      { type: "REGULAR", status: "APPROVED", monthsAgo: 4, days: 1, reason: "Family function" },
      { type: "COMPENSATORY", status: "APPROVED", monthsAgo: 3, days: 1, reason: "Comp off for weekend deployment" },
      { type: "PAID", status: "APPROVED", monthsAgo: 2, days: 2, reason: "Long weekend; Monday-Tuesday off" },
      { type: "PAID", status: "APPROVED", monthsAgo: 1, isHalfDay: true, halfDaySession: "AFTERNOON", reason: "Bank appointment" },
      { type: "REGULAR", status: "PENDING", monthsAgo: 0, days: 1, reason: "House shifting" },
    ], () => rand());
  } else {
    // Kabir: flexible, a rejected conflict, a medical half-day, upcoming vacation.
    await seedAttendanceFor(userId, { wfhBias: 0.55, lateBias: 0.05, otBias: 0.02 }, () => rand());
    await seedLeavesFor(userId, [
      { type: "PAID", status: "REJECTED", monthsAgo: 4, days: 3, reason: "Requested leave clashed with a release" },
      { type: "PAID", status: "APPROVED", monthsAgo: 3, isHalfDay: true, halfDaySession: "AFTERNOON", reason: "Dental clinic" },
      { type: "REGULAR", status: "APPROVED", monthsAgo: 2, days: 1, reason: "Voter enrollment" },
      { type: "REGULAR", status: "APPROVED", monthsAgo: 1, isHalfDay: true, halfDaySession: "MORNING", reason: "Marriage registration" },
      { type: "PAID", status: "PENDING", futureDays: 9, days: 2, reason: "Weekend trip planned" },
    ], () => rand());
  }

  const leaves = await prisma.leaveRequest.count({ where: { userId } });
  console.log(`  ★ seeded FY ${fy} dummies for ${userId} (${leaves} leaves)`);
}

run(async () => {
  await upsertRoles();

  let employeeIdx = 0;
  for (const u of USERS) {
    const userId = await ensureUser(u);
    if (!u.isSuperAdmin && u.role === "Employee") {
      await seedDummyData(userId, employeeIdx);
      employeeIdx++;
    }
  }

  // Drop legacy roles (MD, Accounts) — users above are already reassigned
  // to Super Admin/Admin/Employee.
  await prisma.role.deleteMany({
    where: { name: { notIn: ROLES.map((r) => r.name) } },
  });
  console.log("Roles pruned to: Super Admin, Admin, Employee");

  console.log("Seeded users (admin@company.local / admin123; employees use emp12345)");
});
