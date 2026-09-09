import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/features/shell/page-header";
import { SessionsPanel } from "@/features/attendance/sessions-panel";
import { PasskeysPanel } from "@/features/shell/passkeys-panel";

export const metadata: Metadata = { title: "Security" };

export default function SecurityPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Security"
        subtitle="Review where your account is signed in, and register this device for passkey sign-in."
      />
      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
          <CardDescription>
            Devices currently signed in as you. Revoke anything you do not recognize.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SessionsPanel />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Passkeys</CardTitle>
          <CardDescription>
            Register Face ID, fingerprint, or device PIN on this device. Password sign-in keeps working.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasskeysPanel />
        </CardContent>
      </Card>
    </div>
  );
}
