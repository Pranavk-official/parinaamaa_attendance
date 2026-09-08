import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth-user";
import { isLeaveExempt } from "@/lib/leave-policy";
import { punchIn } from "@/lib/punch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { CheckCircle2, Clock, LayoutDashboard, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PunchWidget } from "@/components/punch-widget";
import type { AttendanceType } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Office Punch" };
export const dynamic = "force-dynamic";

export default async function WfoPunchPage() {
  const user = await getCurrentUser();
  // Ensure a valid session exists even after middleware; paranoia is cheap here.
  if (!user) redirect("/login?callbackUrl=/attendance/wfo-punch");
  // Admin accounts record no attendance, so a stray scan just goes home.
  if (isLeaveExempt(user)) redirect("/");

  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for") ?? headerList.get("x-real-ip");
  const clientIp = forwarded ? forwarded.split(",")[0].trim() : null;
  // The network guard is opt-in: with OFFICE_IP_ADDRESS unset, any signed-in
  // scan punches in. Set it to the office's public IP to turn the guard on.
  const officeIp = process.env.OFFICE_IP_ADDRESS;

  let result: {
    alreadyPunched: boolean;
    type?: string;
    punchedOut?: boolean;
    error?: string;
  } | null = null;
  if (officeIp && clientIp !== officeIp) {
    result = { alreadyPunched: false, error: "Not on the office network. WFO punch rejected." };
  } else {
    const res = await punchIn(user.id, "WFO");
    result = {
      alreadyPunched: res.alreadyPunched,
      type: res.attendance.type,
      punchedOut: res.attendance.punchOut !== null,
    };
  }

  return (
    <PageShell>
      <div className="flex flex-col gap-4">
        {result.error ? (
          <Status
            icon={ShieldAlert}
            tone="text-destructive"
            title="Punch rejected"
            detail={result.error}
          />
        ) : result.type ? (
          <Status
            icon={CheckCircle2}
            tone="text-emerald-600 dark:text-emerald-400"
            title={`${result.type} punched in`}
            detail={`IP ${clientIp} verified against the office network.`}
          />
        ) : (
          <Status
            icon={Clock}
            tone="text-muted-foreground"
            title="Already punched in today"
            detail="Your entry for today is already recorded."
          />
        )}

        {/* Punching out from here saves a trip back to the dashboard, which is
            where the QR used to leave people stranded. */}
        {result.type && (
          <PunchWidget
            type={result.type as AttendanceType}
            punchedOut={result.punchedOut ?? false}
          />
        )}

        <Button variant="outline" render={<Link href="/" />}>
          <LayoutDashboard />
          Go to dashboard
        </Button>

        <p className="text-xs text-muted-foreground">
          One attendance entry is kept per day; refreshing will not create duplicates.
        </p>
      </div>
    </PageShell>
  );
}

function Status({
  icon: Icon,
  tone,
  title,
  detail,
}: {
  icon: typeof Clock;
  tone: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className={`mt-0.5 size-5 shrink-0 ${tone}`} aria-hidden />
      <div>
        <p className="font-heading text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Office Punch</CardTitle>
          <CardDescription>Scan by the office entrance to punch in.</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}