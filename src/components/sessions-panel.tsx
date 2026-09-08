"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ShieldX } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Session = Awaited<ReturnType<typeof authClient.listSessions>>["data"][number];

function SessionRow({
  session,
  currentId,
  onRevoke,
  pending,
}: {
  session: Session;
  currentId: string | null;
  onRevoke: (s: Session) => void;
  pending: boolean;
}) {
  return (
    <TableRow>
      <TableCell>
        {session.userAgent ? (
          <span className="block text-sm">{session.userAgent}</span>
        ) : (
          <span className="text-sm text-muted-foreground">Unknown device</span>
        )}
        <span className="text-xs text-muted-foreground">{session.ipAddress ?? "-"}</span>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {new Date(session.createdAt).toLocaleString()}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {new Date(session.expiresAt).toLocaleString()}
      </TableCell>
      <TableCell>
        {session.id === currentId ? (
          <Badge>This device</Badge>
        ) : (
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() => onRevoke(session)}
          >
            {pending && <Spinner />}
            Revoke
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

export function SessionsPanel() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [target, setTarget] = useState<Session | null>(null);
  const [revokeAll, setRevokeAll] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    (async () => {
      const [listRes, activeRes] = await Promise.all([
        authClient.listSessions(),
        authClient.getSession(),
      ]);
      const data = listRes.data ?? [];
      setSessions(data);
      const activeToken = activeRes.data?.session.token;
      setCurrentId(data.find((s) => s.token === activeToken)?.id ?? null);
    })();
  }, []);

  const confirmTarget = target;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => setRevokeAll(true)}
        >
          <ShieldX className="mr-2 size-4" />
          Revoke all other sessions
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Device</TableHead>
            <TableHead>Signed in</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              currentId={currentId}
              onRevoke={setTarget}
              pending={pending}
            />
          ))}
          {sessions.length === 0 &&
            Array.from({ length: 3 }, (_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 4 }, (_, c) => (
                  <TableCell key={c}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
        </TableBody>
      </Table>

      <AlertDialog open={!!confirmTarget || revokeAll} onOpenChange={() => { setTarget(null); setRevokeAll(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {revokeAll ? "Revoke all other sessions?" : "Revoke this session?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {revokeAll
                ? "Every device except this one will be signed out immediately."
                : "This device will be signed out immediately. It can sign back in with its password."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setTarget(null); setRevokeAll(false); }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const res = revokeAll
                    ? await authClient.revokeOtherSessions()
                    : await authClient.revokeSession({ token: confirmTarget?.token ?? "" });
                  if (!res.error) {
                    toast.success(revokeAll ? "Other sessions revoked" : "Session revoked");
                    const fresh = await authClient.listSessions();
                    setSessions(fresh.data ?? []);
                  } else {
                    toast.error(res.error.message ?? "Failed");
                  }
                  setTarget(null);
                  setRevokeAll(false);
                });
              }}
            >
              {pending && <Spinner />}
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}