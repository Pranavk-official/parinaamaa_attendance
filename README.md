# Attendance

Attendance, leave and payroll-input tracking for Parinaamaa.ai. Employees punch
in and out, apply for leave, and see their balances; admins approve leave,
manage accounts and export a monthly payroll sheet.

Built with Next.js 16 (App Router, webpack), Prisma 7 on PostgreSQL, Better
Auth, and shadcn/ui in the `base-lyra` style (Base UI + Tailwind v4).

---

## Quick start

```bash
cp .env.example .env          # then edit — see Configuration below
docker compose -f docker-compose.dev.yml up
```

The web container runs `prisma migrate deploy`, seeds dummy data, and starts
`next dev` on <http://localhost:3000>. Sign in as `admin@company.local` /
`admin123`.

To run outside Docker you still need the database container:

```bash
docker compose -f docker-compose.dev.yml up db
bun install
bunx prisma generate
bunx prisma migrate deploy
bun prisma/seed.ts
bun run dev
```

Use **bun** (there is a `bun.lock`), not npm or pnpm.

---

## Configuration

Everything is environment variables. Copy `.env.example` to `.env`; both compose
files read it. Generate secrets with `openssl rand -hex 32`.

| Variable | Required | Used for |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | yes | Password the `db` container is created with. Must match the one inside `DATABASE_URL`. |
| `DATABASE_URL` | yes | Prisma connection string. Compose overrides it for the containers (host `db`); the value in `.env` is what you use from the host (host `localhost`). |
| `BETTER_AUTH_SECRET` | yes | Session signing key. **32 characters minimum** — Better Auth refuses to start below that. |
| `BETTER_AUTH_URL` | yes | Public origin, e.g. `https://attendance.example.com`. Used for auth callbacks and for the "Approve here" link in leave email. |
| `CRON_SECRET` | yes | Bearer token for `POST /api/cron/export-payroll`. The scheduler reads it from inside the web container. |
| `OFFICE_IP_ADDRESS` | no | Public IP of the office. Set it and `/attendance/wfo-punch` (see [the office QR code](#the-office-qr-code)) rejects scans from anywhere else. **Leave blank and the network guard is off** — any signed-in scan punches in. |
| `MANAGER_EMAIL` | no | Overrides who leave mail is addressed to. Defaults to the address in `src/lib/leave-mail.ts`. |
| `PORT_EXTERNAL` | no | Host port published by compose. Default `3000`. Change it when the host already uses 3000 — Dokploy's own UI does. |
| `PORT_INTERNAL` | no | Port Next listens on inside the container, passed through as `PORT`. Default `3000`. The healthcheck and the payroll cron both read it, so they follow automatically. |

### Things that are configured in code, not env

| What | Where |
| --- | --- |
| Leave email recipient, Cc, and the greeting name | `src/lib/leave-mail.ts` (`LEAVE_MAIL`) |
| Wording of the request, approval and rejection emails | `src/lib/leave-mail.ts` |
| Which leave types carry a balance | `src/lib/leave-policy.ts` (`ALLOCATABLE_LEAVE_TYPES`) |
| Loss-of-pay formula | `src/lib/fiscal.ts` (`unpaidDeduction`) |
| Fiscal year (April–March) | `src/lib/fiscal.ts` |
| Roles and their permissions | `prisma/seed-common.ts` (`ROLES`) |
| Payroll export schedule | `ofelia.job-exec.payroll.schedule` in `docker-compose.yml` |

### Behind a reverse proxy

If you set `OFFICE_IP_ADDRESS`, it is matched against the first entry of
`x-forwarded-for` (falling back to `x-real-ip`). Your proxy must set one of
those to the real client IP, or every WFO punch is rejected.

---

## Commands

| Command | What it does |
| --- | --- |
| `bun run dev` | Dev server. |
| `bun run build` | Production build. |
| `bun run lint` | ESLint (next core-web-vitals + typescript). |
| `bun scripts/check.ts` | Assertions over the fiscal, leave and email-template maths. There is no test framework — add asserts here. |
| `bunx prisma generate` | Regenerate the client after editing `prisma/schema.prisma`. Output lands in `src/generated/prisma`, which is gitignored. |
| `bunx prisma migrate deploy` | Apply migrations. |
| `bun prisma/seed.ts` | **Local dummy data** — fake staff and a fabricated year of attendance. Wipes and rewrites each employee's attendance and leave. |
| `bun prisma/seed.prod.ts` | **Production seed** — roles and the two real accounts only. Deletes nothing, safe to re-run. |

`dev` and `build` must keep their `--webpack` flag. Next 16 defaults to
Turbopack, and the `@ducanh2912/next-pwa` wrapper needs webpack.

---

## Deploying

```bash
cp .env.example .env          # fill in real secrets and BETTER_AUTH_URL
docker compose up -d --build
```

`docker-compose.yml` builds the `prod` target, which on start runs
`prisma migrate deploy`, then `prisma/seed.prod.ts`, then `next start`.

The production seed creates:

| Email | Role | Designation |
| --- | --- | --- |
| `neethu@parinaamaa.ai` | Super Admin | Managing Director |
| `accounts@parinaamaa.ai` | Admin | Accounts |

Each account's initial password is its own email address. **Change both at first
sign-in** — they are guessable from the domain alone.

An `ofelia` container calls the payroll export on the first of each month. It
waits for the web container's healthcheck, so do not remove that healthcheck.

Two things about those labels are easy to get wrong, and both fail quietly:

- They live on the **web** service, not on `ofelia`. Ofelia execs into the
  container that carries them. On `ofelia` itself the job registers and then
  fails with `error creating exec: No such container:`.
- The opt-in label is `ofelia.enabled`, not `ofelia.enable`. With the wrong
  spelling ofelia finds no jobs, logs `unable to start a empty scheduler`, and
  restart-loops.

The command runs `bun`, because the image has neither `wget` nor `curl`, and
reads `CRON_SECRET` and `PORT` from the container's own environment rather than
from a label — which also keeps the secret out of `docker inspect`.

### Networks

Two, in production:

| Network | Members | Why |
| --- | --- | --- |
| `internal` | db, web, ofelia | Private to the stack. Postgres and the scheduler are never reachable from outside it. |
| `dokploy-network` | web only | Dokploy's shared network, where its Traefik runs. A domain attached in Dokploy reaches the app through it. |

Declared `external: true`, so Dokploy's own network is used rather than a new
one. Deploying without Dokploy? Either run `docker network create dokploy-network`
once, or delete that network and web's reference to it. The dev stack has no
Traefik, so it gets `internal` only.

### Dokploy

Create a **Compose** service, not an Application — an Application builds a
single container from the Dockerfile and gives you no Postgres and no
scheduler. Then:

- Set the environment variables from the table above in the **Environment** tab.
- Set `PORT` to something free. Dokploy's own UI holds `3000`, and a clash
  there fails the deploy with `Bind for 0.0.0.0:3000 failed: port is already
  allocated`.
- Attach a domain in the **Domains** tab, pointing at service `web` and
  whatever `PORT` you chose.

Once a domain routes through Traefik, the published host port earns nothing —
delete the `ports:` block from the web service if you would rather not expose
it at all.

#### Domain returns 404

A 404 at the domain while the container logs show `✓ Ready` is Traefik, not the
app: no router matched, or the one that did could not reach the container. On
the server, in order:

```bash
# 1. Does the app answer at all? (uses the published host port)
curl -I http://localhost:$PORT/login

# 2. Is web actually on Dokploy's network?
docker inspect <project>-web-1 --format '{{json .NetworkSettings.Networks}}' | tr ',' '\n' | grep -o '"[a-z-]*network"'

# 3. Did Dokploy write a router for the domain?
docker inspect <project>-web-1 --format '{{json .Config.Labels}}' | tr ',' '\n' | grep traefik
```

`web` deliberately joins two networks, so Traefik has to be told which one to
dial — that is the `traefik.docker.network: dokploy-network` label on the
service. Without it Traefik can pick `internal`, which its own container is not
on, and every request 404s.

If step 3 shows no `traefik.http.routers.*` labels, Dokploy did not inject
them: re-save the domain in the Domains tab and redeploy. Dokploy's generated
labels merge with the ones already in the file.

Postgres data lives in the `pgdata` volume. Back that up.

---

## How it works

### Roles

Three roles, seeded and kept in sync on every run:

| Role | Permissions |
| --- | --- |
| Super Admin | `*` |
| Admin | `manage:users`, `manage:leaves`, `view:reports`, `export:payroll` |
| Employee | none |

Anyone holding permissions is *leave-exempt*: no balances, no leave form, never
blocked by a balance check. Employees are the tracked staff.

### Attendance

- **WFO** — scan the office QR, which opens `/attendance/wfo-punch`. If
  `OFFICE_IP_ADDRESS` is set, the punch only succeeds from that IP.
- **WFH** — the punch widget on the dashboard.
- **Offday work** — any punch on a Saturday, Sunday or a row in
  `CompanyHoliday` is recorded as offday work automatically.

`CompanyHoliday` has no admin screen yet; add rows directly in the database.

#### The office QR code

Encode this URL, and print it by the entrance:

```
https://<your BETTER_AUTH_URL host>/attendance/wfo-punch
```

For the local dev stack that is <http://localhost:3000/attendance/wfo-punch>.
There is nothing per-employee in it — one poster serves everyone, and it never
needs reprinting.

Scanning it punches the visitor in straight away. Two things gate it:

- **Signed in.** Someone with no session is sent to `/login?callbackUrl=/attendance/wfo-punch`
  and lands back on the punch page once they sign in.
- **On the office network — only if you switch it on.** With `OFFICE_IP_ADDRESS`
  set, the page compares the caller's IP against it and otherwise shows
  *"Not on the office network. WFO punch rejected."*, which makes a photo of the
  QR useless from home. Left blank, the guard is off and any signed-in scan
  works from anywhere.

Scanning twice in a day is harmless: the second scan reports the existing punch
rather than creating a second one.

The login page's Open Graph image (`src/app/login/opengraph-image.tsx`) renders
this same QR from `BETTER_AUTH_URL`, so sharing the login link in Slack or
WhatsApp shows a scannable poster. Print from there, or generate your own from
the URL above.

One record per person per day. Punching is one-way: there is no second punch-in,
so both punch buttons confirm first.

### Leave

Three types. A half day is a checkbox on any of them, never a type of its own.

| Type | Balance | Notes |
| --- | --- | --- |
| `PAID` | accrues per month, in whole days | A half day draws 0.5 from it. |
| `COMPENSATORY` | annual lump | Set by an admin; not credited automatically for offday work. |
| `REGULAR` | none | Unpaid. Uncapped. Deducted from salary. |

The paid balance decides the rest. Whichever type the employee picks, the
request is recorded as `PAID` while enough paid days remain and as `REGULAR`
once they run out — checked at submission and again when the balance is actually
spent at approval.

Half days are always 0.5 days, cover a single date, and cannot be backdated.

Allocation lives in the Add user and Edit user dialogs and in the user import.
There is no separate allocate screen.

### Email

The app does not send mail itself. It builds a Gmail compose link and opens it,
so the message goes from the signed-in person's own account, and they see it
before it leaves. Requests and rejections come with a drafted message that the
sender can edit in an accordion before sending; anything the form has not filled
in shows as a `[square bracket placeholder]`.

### Payroll export

`GET /api/export/payroll?format=csv|xlsx&month=YYYY-MM` — needs
`export:payroll`. Defaults to the last complete month.

`POST /api/cron/export-payroll` — same data, authorised by
`Authorization: Bearer $CRON_SECRET`.

Columns: name, email, designation, present days, total hours, offday work days,
approved leaves, **unpaid leave days**, **monthly gross**, **unpaid deduction**,
leave types.

Salary is stored per user as either a monthly gross or an annual CTC. The
deduction is `monthly gross ÷ days in the payroll month × unpaid days`. Change
the divisor in `unpaidDeduction` if payroll switches to working days.

---

## Conventions

- **Prisma 7** — import from `@/generated/prisma/client`, never `@prisma/client`.
  Every `PrismaClient` needs the `@prisma/adapter-pg` driver adapter. Config is
  in `prisma7.config.ts`.
- **Server mutations** are server actions in `src/lib/actions/*`. Writes to
  `Attendance` and `LeaveBalance` go through `prismaWithAudit(actorId)`.
- **UI** — build from `src/components/ui/*`. Add new primitives with the shadcn
  CLI; the style is `base-lyra`, not classic Radix shadcn. Tailwind v4 is
  configured in `src/app/globals.css`; there is no `tailwind.config.*`.
- **Destructive and one-way actions confirm first** — deleting a leave request,
  approving or rejecting, punching in or out, signing out, revoking sessions.
