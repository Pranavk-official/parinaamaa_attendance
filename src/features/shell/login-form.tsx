"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Fingerprint } from "lucide-react";
import { usePasskeySupported } from "@/hooks/use-passkey-support";

import { cn } from "cn";
import { authClient } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { PasswordInput } from "@/features/shell/password-input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [passkeyPending, setPasskeyPending] = useState(false);
  const passkeySupported = usePasskeySupported();

  const continueWithPasskey = async () => {
    if (passkeyPending) return;
    setPasskeyPending(true);
    const res = await authClient.signIn.passkey(
      { autoFill: false },
      {
        onSuccess: () => {
          const cb = searchParams.get("callbackUrl");
          router.push(cb ?? "/");
          router.refresh();
        },
      }
    );
    if (res.error) {
      const code = "code" in res.error ? res.error.code : undefined;
      if (code !== "AUTH_CANCELLED") {
        toast.error(res.error.message ?? "Passkey sign-in failed");
      }
    }
    setPasskeyPending(false);
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>Sign in with your work email.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const email = String(form.get("email")).trim();
              const password = String(form.get("password"));
              setPending(true);
              authClient.signIn.email(
                { email, password },
                {
                  onError: (ctx) => {
                    toast.error(ctx.error.message ?? "Sign in failed");
                    setPending(false);
                  },
                  onSuccess: () => {
                    const cb = searchParams.get("callbackUrl");
                    router.push(cb ?? "/");
                    router.refresh();
                  },
                }
              );
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@company.local"
                  autoComplete="email"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <PasswordInput
                  id="password"
                  name="password"
                  required
                  autoComplete="current-password"
                />
              </Field>
              <Field>
                <Button className="w-full" type="submit" disabled={pending}>
                  {pending && <Spinner />}
                  Sign in
                </Button>
              </Field>
            </FieldGroup>
          </form>
          {passkeySupported && (
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={pending || passkeyPending}
                onClick={continueWithPasskey}
              >
                {passkeyPending ? <Spinner /> : <Fingerprint />}
                Continue with passkey
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}