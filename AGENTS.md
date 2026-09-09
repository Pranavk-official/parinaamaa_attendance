<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Attendance (Next.js 16 + Prisma 7 + Better Auth)

## Package manager
- Use **bun** (bun.lock), not npm/pnpm. Dockerfile installs with `bun install`.

## Commands
- `bun run dev` / `bun run build` — both must keep the `--webpack` flag (Next 16 defaults to Turbopack; the `@ducanh2912/next-pwa` wrapper requires webpack). Do not drop it.
- `bun run lint` — eslint (next core-web-vitals + typescript).
- No test framework. Only check: `bun scripts/check.ts` (fiscal/leave-day math). Add asserts there, not a test runner.
- After editing `prisma/schema.prisma`: `bunx prisma generate`. `src/generated/prisma` is gitignored and regenerated.

## shadcn / UI (important)
- Style is **`base-lyra`**: **Base UI** (`@base-ui/react`) primitives + **Tailwind v4** + `data-slot` naming. This is NOT the old Radix + Tailwind v3 shadcn you may know — do not copy registry code from the classic shadcn.
- Tailwind v4 is configured **in CSS** (`@theme inline` + CSS vars in `src/app/globals.css`). There is no `tailwind.config.*`; do not create one.
- Components live in `src/components/ui/*` and are imported as `@/components/ui/<name>`. `cn` comes from the `cn` package (`import { cn } from "cn"`) or `@/lib/utils`.
- **Build UI from the existing shadcn components** (`Button`, `Card`, `Input`, `Select`, `Dialog`, `Table`, `Sidebar`, `Badge`, `Calendar`, `Popover`, …). Do not hand-roll raw classNames where a ui primitive exists. Add new components via the shadcn CLI (MCP preconfigured in `opencode.json`).
- Icons: ui primitives ship with `@phosphor-icons/react` (matches `components.json`); feature components use `lucide-react`. Keep icon imports consistent with the file's neighbours.

## Prisma 7 (not v6)
- `generator client` = `prisma-client`, outputs to `src/generated/prisma`. **Import from `@/generated/prisma/client`, never `@prisma/client`** — that package is the legacy v6 import.
- Prisma 7 requires a **driver adapter** (`@prisma/adapter-pg`). Every new `PrismaClient` must pass `adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })` (see `src/lib/db/prisma.ts`, `prisma/seed.ts`).
- Config lives in `prisma7.config.ts` (schema + migrations + datasource). DB is postgres, provided by docker compose.
- Import types/enums from `@/generated/prisma/client` (e.g. `AttendanceType`, `LeaveType`).

## Auth & access
- Better Auth in `src/lib/auth/auth.ts` (adapter = prismaAdapter). Route handler already wired at `src/app/api/auth/[...all]/route.ts`.
- `getCurrentUser()` (react `cache``d) in `src/lib/auth/auth-user.ts`; `mustUser()`, `hasPermission()`, `requirePermission()` helpers there.
- App routes live under `src/app/(app)/` and are gated in its `layout.tsx` (redirect to `/login` if no user).
- `src/proxy.ts` is a Next proxy map protecting `/attendance/wfo-punch`.
- Server mutations are **server actions** in `src/lib/server/actions/*`. Audit logging for `Attendance`/`LeaveBalance` writes goes through `prismaWithAudit(actorId)` in `src/lib/db/prisma.ts`.

## Env / DB / infra
- Copy `.env.example` → `.env`. Ops secrets: `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET` (≥32 chars), `BETTER_AUTH_URL`, `OFFICE_IP_ADDRESS` (WFO punch-in IP guard), `CRON_SECRET`, `MANAGER_EMAIL` (leave manager notification).
- Dev DB: `docker compose -f docker-compose.dev.yml up`. Prod: `docker-compose.yml` (+ `ofelia` cron service calling `/api/cron/export-payroll` monthly with `CRON_SECRET` bearer).
- Container start runs `prisma migrate deploy` + seed (`bun prisma/seed.ts`). Seed creates roles and `admin@company.local` / `admin123` super admin.

## Style
- Prefer the repo's skill set (`ponytail`, `prisma-*`, `next-*` in `.claude/skills/` and `.agents/skills/`) before hand-writing equivalent solutions.
