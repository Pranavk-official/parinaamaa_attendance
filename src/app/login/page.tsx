import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarCheck } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { QrScanner } from "@/components/qr-scanner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center justify-center gap-2 self-center">
          <div className="flex size-8 items-center justify-center bg-primary text-primary-foreground">
            <CalendarCheck className="size-4" />
          </div>
          <div className="leading-tight">
            <p className="font-heading text-sm font-medium">Attendance</p>
            <p className="text-xs text-muted-foreground">Leave &amp; hours</p>
          </div>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
        <Card>
          <CardHeader>
            <CardTitle>Punch from the office</CardTitle>
            <CardDescription>Scan the office WFO QR, then sign in to punch.</CardDescription>
          </CardHeader>
          <CardContent>
            <QrScanner />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
