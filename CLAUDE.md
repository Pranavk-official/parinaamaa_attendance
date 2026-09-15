# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Conventions (bun, Next 16 `--webpack`, Prisma 7 imports, shadcn `base-lyra`) are in
AGENTS.md above; the full operator manual is `README.md`. This file covers the
architecture those two do not.

## Commands beyond AGENTS.md

| Command | What it does |
| --- | --- |
| `bunx tsc --noEmit` | Typecheck. Faster than a build when checking a component change. |
| `bunx prisma migrate deploy` | Apply migrations (containers run this on start). |
| `bun prisma/seed.ts` | **Dev only.** Wipes and regenerates each employee's attendance and leave. |
| `bun prisma/seed.prod.ts` | Roles + the two real accounts, upsert-only, safe to re-run. |

`bun scripts/check.ts` is the whole test suite: a single file of `assert` calls over
the pure domain functions. New business math belongs there — there is no runner to add
a spec file to.

## Architecture

Dependencies run one way: `app/` (RSC pages) → `features/` (client components) →
`lib/server/actions/` (mutations) → `lib/domain/` (rules) → `lib/db/prisma`.

**`lib/domain/` is the rulebook and is deliberately Prisma-light.** `fiscal.ts` and
`leave-policy.ts` are pure functions with no imports from the client, which is what
lets `scripts/check.ts` assert them without a database. `export-payroll.ts` re-exports
`monthRange`/`periodRange` from `fiscal.ts` for that reason — put new math in the pure
file and re-export, not in an action or a component.

**Access control is checked three times, and only the last one counts.**

1. `src/proxy.ts` — cookie presence only, and only for `/attendance/wfo-punch`.
2. `src/app/(app)/layout.tsx` — `getCurrentUser()` or redirect to `/login`, then passes
   permission booleans down to `Nav` so the sidebar and bottom nav build from one source
   (`features/shell/nav-items.ts`).
3. Every page and every server action re-checks with `mustUser()` +
   `requirePermission(user, "…")`. Permissions are strings — `manage:users`,
   `manage:leaves`, `view:reports`, `export:payroll` — and both `isSuperAdmin` and a
   `"*"` entry bypass the check (`lib/auth/auth-user.ts`).

**"Leave-exempt" is the user distinction that matters**, not the role name. `isLeaveExempt()`
means anyone whose role carries permissions: no leave balances, no leave form, and
excluded from payroll rows. Nav, dashboard and reports all branch on it.

**Audit logging is opt-in per query.** `prismaWithAudit(actorId)` is a `$extends` wrapper
that writes an `AuditLog` row on `update` / `updateMany` / `delete` of `LeaveBalance`,
`Attendance` and `User` — creates are not audited, and the write is fire-and-forget so it
never blocks. A mutation on those models that uses the plain `prisma` client disappears
from `/audit` with no error.

**Payroll settings live in the DB, not env.** `Setting` is a key/value table read through
`getPayrollDay()` (salary month start, 1–28) and `getFiscalStart()` (`"MM-DD"`, default
April 1) in `lib/domain/settings.ts` — both `cache()`d per request with hardcoded
fallbacks, so a missing row is normal. A payroll month is therefore not necessarily a
calendar month.

**One period vocabulary spans three layers.** `PayrollPeriod = { month?: "YYYY-MM", from?, to? }`
is resolved by `periodRange(payrollDay, period)`, and the same shape flows from the
`/reports` search params → `collectPayrollRows()` → `/api/export/payroll` (and the ofelia
cron POST to `/api/cron/export-payroll`). Changing the filter means changing all three.

**Leave type is resolved, not chosen.** Whatever the employee picks, `resolveLeaveType()`
records it as `PAID` while the balance lasts and unpaid `REGULAR` after — checked at
submission and again when the balance is actually spent at approval. Half days are always
0.5 and single-date.

**Mail is composed, never sent.** `leave-mail.ts` builds a Gmail compose URL that opens in
the sender's own browser; the app has no SMTP path.

## UI notes

- Base UI, not Radix: triggers take `render={<Button />}`, never `asChild`. `Select.Value`
  prints the raw value unless given a function child or `items`.
- `ButtonGroup` is layout only (it joins adjacent `Button`s or `SelectTrigger`s). Selection
  state belongs to `ToggleGroup` (filters) or `Tabs` (panels) — do not fake a selected state
  by swapping `Button` variants.
