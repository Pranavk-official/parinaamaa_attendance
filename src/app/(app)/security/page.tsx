import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SessionsPanel } from "@/components/sessions-panel";

export default function SecurityPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active sessions</CardTitle>
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