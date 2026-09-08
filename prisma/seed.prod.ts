// Production seeder: roles and the two real accounts, nothing else. It runs on
// every container start but only does work on an empty database — see the guard
// below. Use prisma/seed.ts for local dummy data.
import { ensureUser, prisma, run, upsertRoles, type SeedUser } from "./seed-common";

// The password is the email address for the first sign-in. Both accounts are
// leave-exempt (Super Admin, and Admin carries permissions), so neither gets a
// leave allocation.
const USERS: SeedUser[] = [
  {
    name: "Neethu",
    email: "neethu@parinaamaa.ai",
    password: "neethu@parinaamaa.ai",
    designation: "Managing Director",
    role: "Super Admin",
    isSuperAdmin: true,
  },
  {
    name: "Accounts",
    email: "accounts@parinaamaa.ai",
    password: "accounts@parinaamaa.ai",
    designation: "Accounts",
    role: "Admin",
  },
];

run(async () => {
  // Seed once, on first boot only. ensureUser() skips creating an account that
  // already exists, but it still rewrites roleId/designation/isSuperAdmin/salary,
  // and upsertRoles() rewrites permissions — so re-running would revert whatever
  // an admin has since changed in the UI. Any user at all means this database is
  // already set up.
  const users = await prisma.user.count();
  if (users > 0) {
    console.log(`Database already seeded (${users} users) — skipping.`);
    return;
  }

  await upsertRoles();
  for (const u of USERS) await ensureUser(u);
  console.log(
    "Production seed done. Each account's password is its own email address — change both after first sign-in."
  );
});
