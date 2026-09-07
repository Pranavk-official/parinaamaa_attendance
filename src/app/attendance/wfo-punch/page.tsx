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
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Office Punch" };
export const dynamic = "force-dynamic";

export default async function WfoPunchPage() {
  const user = await getCurrentUser();
  // Ensure a valid session exists even after middleware; paranoia is cheap here.
  if (!user) redirect("/login?callbackUrl=/attendance/wfo-punch");
  if (isLeaveExempt(user)) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Admin accounts do not punch in.</p>
      </PageShell>
    );
  }

  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for") ?? headerList.get("x-real-ip");
  const clientIp = forwarded ? forwarded.split(",")[0].trim() : null;
  const officeIp = process.env.OFFICE_IP_ADDRESS;

  let result: { alreadyPunched: boolean; type?: string; error?: string } | null = null;
  if (!officeIp) {
    result = { alreadyPunched: false, error: "OFFICE_IP_ADDRESS not configured" };
  } else if (!clientIp || clientIp !== officeIp) {
    result = { alreadyPunched: false, error: "Not on the office network. WFO punch rejected." };
  } else {
    const res = await punchIn(user.id, "WFO");
    result = { alreadyPunched: res.alreadyPunched, type: res.attendance.type };
  }

  return (
    <PageShell>
      <div className="flex flex-col gap-3">
        {result.error ? (
          <Badge variant="destructive">{result.error}</Badge>
        ) : result.type ? (
          <>
            <Badge>{result.type} punched in</Badge>
            <p className="text-sm text-muted-foreground">
              IP {clientIp} verified against office network.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Already punched in today. See your dashboard to punch out.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          First attendance entry is kept per day; refresh will not create duplicates.
        </p>
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Office Punch</CardTitle>
          <CardDescription>Scan by the office entrance to punch in.</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}