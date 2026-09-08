import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { SessionsPanel } from "@/components/sessions-panel";

export const metadata: Metadata = { title: "Security" };

export default function SecurityPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Security"
        subtitle="Review where your account is signed in and cut off anything unfamiliar."
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
    </div>
  );
}
