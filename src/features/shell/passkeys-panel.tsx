"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Fingerprint, Plus, Trash2 } from "lucide-react";
import { authClient } from "@/lib/auth/auth-client";
import { usePasskeySupported } from "@/hooks/use-passkey-support";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveConfirm } from "@/features/shell/responsive-confirm";

type Passkey = Awaited<
  ReturnType<typeof authClient.passkey.listUserPasskeys>
>["data"][number];

export function PasskeysPanel() {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loaded, setLoaded] = useState(false);
  const supported = usePasskeySupported();
  const [name, setName] = useState("");
  const [target, setTarget] = useState<Passkey | null>(null);
  const [busy, startTransition] = useTransition();

  const load = useCallback(async () => {
    const res = await authClient.passkey.listUserPasskeys();
    if (res.error) {
      toast.error(res.error.message ?? "Could not load passkeys");
      return;
    }
    setPasskeys(res.data ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      await load();
      setLoaded(true);
    })();
  }, [load]);

  const add = () => {
    const label = name.trim();
    startTransition(async () => {
      const res = await authClient.passkey.addPasskey({
        ...(label ? { name: label } : {}),
        authenticatorAttachment: "platform",
      });
      if (res.error) {
        toast.error(res.error.message ?? "Could not add this passkey");
        return;
      }
      setName("");
      toast.success("Passkey added. Use it on this device next time you sign in.");
      await load();
    });
  };

  const remove = () => {
    if (!target) return;
    startTransition(async () => {
      const res = await authClient.passkey.deletePasskey({ id: target.id });
      if (res.error) {
        toast.error(res.error.message ?? "Could not remove this passkey");
        return;
      }
      setTarget(null);
      toast.success("Passkey removed");
      await load();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="passkey-name">Device name</FieldLabel>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="passkey-name"
            value={name}
            maxLength={80}
            disabled={busy}
            placeholder="This iPhone"
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            type="button"
            className="sm:w-auto"
            disabled={busy || !supported}
            onClick={add}
          >
            {busy ? <Spinner /> : <Plus />}
            Add passkey
          </Button>
        </div>
        <FieldDescription>
          {supported
            ? "Registers this device’s platform authenticator, so Face ID, fingerprint, or device PIN can sign you in."
            : "This browser does not expose WebAuthn, so a passkey cannot be registered here."}
        </FieldDescription>
      </Field>

      <Table stacked>
        <TableHeader>
          <TableRow>
            <TableHead>Passkey</TableHead>
            <TableHead>Added</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {passkeys.map((passkey) => (
            <TableRow key={passkey.id}>
              <TableCell data-label="Passkey" data-wrap>
                <span className="flex items-center gap-2 text-sm">
                  <Fingerprint className="size-4 text-muted-foreground" />
                  {passkey.name || "Passkey"}
                </span>
              </TableCell>
              <TableCell data-label="Added" className="text-sm text-muted-foreground">
                {passkey.createdAt
                  ? new Date(passkey.createdAt).toLocaleDateString()
                  : "—"}
              </TableCell>
              <TableCell data-label="">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={busy}
                  onClick={() => setTarget(passkey)}
                >
                  <Trash2 />
                  Remove
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!loaded &&
            Array.from({ length: 2 }, (_, i) => (
              <TableRow key={i}>
                {["Passkey", "Added", ""].map((label) => (
                  <TableCell key={label} data-label={label}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          {loaded && passkeys.length === 0 && (
            <TableRow>
              <TableCell
                data-label="Passkey"
                className="text-sm text-muted-foreground"
              >
                No passkey on this account yet.
              </TableCell>
              <TableCell data-label="Added">—</TableCell>
              <TableCell data-label="">—</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <ResponsiveConfirm
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        title={`Remove ${target?.name || "this passkey"}?`}
        description="That device will go back to password sign-in. This cannot be undone."
        cancelDisabled={busy}
        actions={
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={remove}
          >
            {busy && <Spinner />}
            Remove
          </Button>
        }
      />
    </div>
  );
}
