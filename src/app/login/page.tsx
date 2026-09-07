import type { Metadata } from "next";
import { Suspense } from "react";
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
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="flex w-full max-w-md flex-col gap-4">
        <Suspense>
          <LoginForm />
        </Suspense>
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-base">Punch from the office</CardTitle>
            <CardDescription>
              Scan the office WFO QR, then sign in to punch.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QrScanner />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}