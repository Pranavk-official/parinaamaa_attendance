# Structure

Industry standard Next 16 App Router. Current layout already compliant. Only 4 moves applied.

```txt
attendance/
prisma/{schema.prisma,migrations/,seed*.ts}
public/
scripts/check.ts
src/
  app/
    (app)/{page.tsx,layout.tsx,audit/,leaves/,reports/,settings/,users/,security/}
    (auth)/login/page.tsx
    attendance/wfo-punch/page.tsx
    api/{auth/[...all]/route.ts,cron/export-payroll/route.ts,export/payroll/route.ts}
    layout.tsx globals.css manifest.ts
  components/ui/* # untouched shadcn
  features/
    attendance/{punch-widget.tsx,qr-scanner.tsx,sessions-panel.tsx}
    leaves/{leave-form.tsx,leave-actions.tsx}
    users/{users-panel.tsx,users-import.tsx}
    billing/{payroll-settings.tsx,report-export.tsx,charts.tsx}
    shell/{nav.tsx,page-header.tsx,theme-*.tsx,install-prompt.tsx,responsive-confirm.tsx,password-input.tsx,login-form.tsx,fiscal-year-settings.tsx}
  lib/
    auth/{auth.ts,auth-client.ts,auth-user.ts}
    db/prisma.ts
    domain/{fiscal.ts,leave-policy.ts,leave-mail.ts,punch.ts,settings.ts,export-payroll.ts}
    server/actions/{attendance.ts,leave.ts,users.ts,settings.ts}
    utils.ts
  hooks/use-mobile.ts
  proxy.ts instrumentation-client.ts
```

## Moves

- `components/*.tsx` split into `features/<domain>/`
- `login/page.tsx` into `(auth)/`
- `lib/auth*` grouped into `lib/auth/`
- `lib/actions/` into `lib/server/actions/`

## Skipped

`src/types/`, `src/services/`, barrel files, monorepo packages. Add when 2+ apps share code.
