import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { auth } from "../src/lib/auth";
import { fiscalYear } from "../src/lib/fiscal";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Three roles: Super Admin (MD / system owner), Admin (runs users, leaves,
// payroll, reports), Employee (the only role that carries leave balances).
const ROLES = [
  { name: "Super Admin", permissions: ["*"] },
  { name: "Admin", permissions: ["manage:users", "manage:leaves", "view:reports", "export:payroll"] },
  { name: "Employee", permissions: [] },
] as const;

const LEAVE_TYPES = ["REGULAR", "PAID", "COMPENSATORY", "HALF_DAY"] as const;

type SeedUser = {
  name: string;
  email: string;
  password: string;
  designation: string;
  role: string;
  isSuperAdmin?: boolean;
  // Leave allocations for the current fiscal year (employees only).
  leave: Record<(typeof LEAVE_TYPES)[number], number>;
  // PAID leave accrues per month instead of an annual lump.
  paidPerMonth?: number;
};

// Only employees carry leave balances; admins/super admins are exempt.
const USERS: SeedUser[] = [
  { name: "System Admin", email: "admin@company.local", password: "admin123", designation: "Super Admin", role: "Super Admin", isSuperAdmin: true, leave: { REGULAR: 0, PAID: 0, COMPENSATORY: 0, HALF_DAY: 0 } },
  { name: "Arjun Mehta", email: "arjun@company.local", password: "emp12345", designation: "Managing Director", role: "Super Admin", isSuperAdmin: true, leave: { REGULAR: 0, PAID: 0, COMPENSATORY: 0, HALF_DAY: 0 } },
  { name: "Riya Sharma", email: "riya@company.local", password: "emp12345", designation: "Senior HR Manager", role: "Admin", leave: { REGULAR: 0, PAID: 0, COMPENSATORY: 0, HALF_DAY: 0 } },
  { name: "Sana Khan", email: "sana@company.local", password: "emp12345", designation: "Accountant", role: "Admin", leave: { REGULAR: 0, PAID: 0, COMPENSATORY: 0, HALF_DAY: 0 } },
  { name: "Dev Patel", email: "dev@company.local", password: "emp12345", designation: "Software Engineer", role: "Employee", leave: { REGULAR: 2, PAID: 0, COMPENSATORY: 2, HALF_DAY: 0 }, paidPerMonth: 1 },
  { name: "Meera Iyer", email: "meera@company.local", password: "emp12345", designation: "UX Designer", role: "Employee", leave: { REGULAR: 2, PAID: 0, COMPENSATORY: 0, HALF_DAY: 0 }, paidPerMonth: 1 },
  { name: "Kabir Singh", email: "kabir@company.local", password: "emp12345", designation: "Software Engineer", role: "Employee", leave: { REGULAR: 2, PAID: 0, COMPENSATORY: 0, HALF_DAY: 0 }, paidPerMonth: 1 },
] as const;

async function ensureUser(u: SeedUser) {
  const existing = await prisma.user.findUnique({ where: { email: u.email } });
  let userId = existing?.id;

  if (existing) {
    console.log(`  - ${u.email} already exists, skipping`);
  } else {
    const { user } = await auth.api.signUpEmail({
      body: { email: u.email, password: u.password, name: u.name },
    });
    // signUpEmail signs the user in; drop the auto-created session.
    await prisma.session.deleteMany({ where: { userId: user.id } });
    userId = user.id;
    console.log(`  + created ${u.email} (${u.role})`);
  }

  if (!userId) throw new Error(`No user row for ${u.email}`);

  await prisma.user.update({
    where: { id: userId },
    data: {
      roleId: (await prisma.role.findUniqueOrThrow({ where: { name: u.role } })).id,
      designation: u.designation,
      isSuperAdmin: u.isSuperAdmin ?? false,
    },
  });

  // Only employees get leave allocations; everyone else is exempt.
  if (!u.isSuperAdmin && u.role === "Employee") {
    const fy = fiscalYear();
    for (const type of LEAVE_TYPES) {
      const perMonth = type === "PAID" ? (u.paidPerMonth ?? 0) : 0;
      const allocated = type === "PAID" ? 0 : u.leave[type];
      if (!allocated && !perMonth) continue;
      await prisma.leaveBalance.upsert({
        where: {
          userId_fiscalYear_leaveType: { userId, fiscalYear: fy, leaveType: type },
        },
        create: { userId, fiscalYear: fy, leaveType: type, allocated, perMonth },
        update: { allocated, perMonth },
      });
    }
  } else {
    await prisma.leaveBalance.deleteMany({ where: { userId } });
  }

  return userId;
}

async function main() {
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { permissions: [...role.permissions] },
      create: { name: role.name, permissions: [...role.permissions] },
    });
  }
  console.log("Roles seeded");

  for (const u of USERS) {
    await ensureUser(u);
  }

  // Drop legacy roles (MD, Accounts) — users above are already reassigned
  // to Super Admin/Admin/Employee.
  await prisma.role.deleteMany({
    where: { name: { notIn: ROLES.map((r) => r.name) } },
  });
  console.log("Roles pruned to: Super Admin, Admin, Employee");

  console.log("Seeded users (admin@company.local / admin123; employees use emp12345)");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });