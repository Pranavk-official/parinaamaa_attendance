import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { auth } from "../src/lib/auth";
import { fiscalYear } from "../src/lib/fiscal";

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Three roles: Super Admin (MD / system owner), Admin (runs users, leaves,
// payroll, reports), Employee (the only role that carries leave balances).
export const ROLES = [
  { name: "Super Admin", permissions: ["*"] },
  { name: "Admin", permissions: ["manage:users", "manage:leaves", "view:reports", "export:payroll"] },
  { name: "Employee", permissions: [] },
] as const;

export type SeedUser = {
  name: string;
  email: string;
  password: string;
  designation: string;
  role: string;
  isSuperAdmin?: boolean;
  // PAID accrues per month in whole days; COMPENSATORY is an annual lump.
  // REGULAR is unpaid and uncapped, so it is never allocated.
  paidPerMonth?: number;
  compensatory?: number;
  salary?: number;
  salaryBasis?: "MONTHLY" | "ANNUAL";
};

export async function upsertRoles() {
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { permissions: [...role.permissions] },
      create: { name: role.name, permissions: [...role.permissions] },
    });
  }
  console.log("Roles seeded");
}

/** Idempotent: an existing account keeps its password and is only re-synced. */
export async function ensureUser(u: SeedUser) {
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
      salary: u.salary ?? null,
      salaryBasis: u.salaryBasis ?? "MONTHLY",
    },
  });

  // Only employees get leave allocations; everyone else is exempt.
  if (!u.isSuperAdmin && u.role === "Employee") {
    const fy = fiscalYear();
    for (const [type, allocated, perMonth] of [
      ["PAID", 0, u.paidPerMonth ?? 0],
      ["COMPENSATORY", u.compensatory ?? 0, 0],
    ] as const) {
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

export function run(main: () => Promise<void>) {
  main()
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e);
      prisma.$disconnect();
      process.exit(1);
    });
}
