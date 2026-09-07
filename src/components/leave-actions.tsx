"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { approveLeaveAction, rejectLeaveAction } from "@/lib/actions/leave";

export function LeaveActions({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [open, setOpen] = useState(false);

  const run = (sendMail: boolean) => {
    setOpen(false);
    startTransition(async () => {
      const fn = action === "approve" ? approveLeaveAction : rejectLeaveAction;
      const res = await fn(id);
      if (action === "approve" && !res.ok) {
        toast.error("Approval failed");
        return;
      }
      toast.success(action === "approve" ? "Request approved" : "Request rejected");
      if (sendMail && res.composeUrl) window.open(res.composeUrl, "_blank", "noopener");
    });
  };

  return (
    <>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => {
            setAction("approve");
            setOpen(true);
          }}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setAction("reject");
            setOpen(true);
          }}
        >
          Reject
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "reject" ? "Reject" : "Approve"} leave for {name}?
            </DialogTitle>
            <DialogDescription>
              {action === "reject" ? "Reject the request" : "Approve the request"} and
              optionally notify {name} by email.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => run(false)}>
              No mail
            </Button>
            <Button disabled={pending} onClick={() => run(true)}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              <Mail />
              Send mail
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}