"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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
import { wfhPunchInAction, punchOutAction } from "@/lib/actions/attendance";
import type { AttendanceType } from "@/generated/prisma/client";

const TYPE_LABEL: Record<AttendanceType, string> = {
  WFO: "Working from office",
  WFH: "Working from home",
  OFFDAY_WORK: "Offday work",
};

/** Every punch is one-way for the day, so each one asks first. */
function PunchButton({
  label,
  title,
  description,
  variant,
  pending,
  run,
}: {
  label: string;
  title: string;
  description: string;
  variant?: "outline";
  pending: boolean;
  run: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        className="w-full"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        {pending && <Spinner />}
        {label}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => {
                setOpen(false);
                run();
              }}
            >
              {label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function PunchWidget({
  type,
  punchedOut,
}: {
  /** Today's attendance type, or null when not punched in yet. */
  type: AttendanceType | null;
  punchedOut: boolean;
}) {
  const [pending, startTransition] = useTransition();

  // Punched in already (WFO from the office QR, or WFH here): the only
  // remaining action is punching out. Never offer a second punch-in.
  if (type) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{TYPE_LABEL[type]}</p>
        {!punchedOut && (
          <PunchButton
            label="Punch Out"
            variant="outline"
            title="Punch out for today?"
            description="This closes today's attendance. You cannot punch back in afterwards."
            pending={pending}
            run={() =>
              startTransition(async () => {
                const res = await punchOutAction();
                if (res.error) toast.error(res.error);
                else toast.success("Punched out");
              })
            }
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <PunchButton
        label="Punch In (WFH)"
        title="Punch in as working from home?"
        description="Today is recorded as WFH and cannot be changed. Scan the entrance QR instead if you are at the office."
        pending={pending}
        run={() =>
          startTransition(async () => {
            const res = await wfhPunchInAction();
            if (res.error) toast.error(res.error);
            else toast.success(`Punched in (${res.type})`);
          })
        }
      />
      <p className="text-xs text-muted-foreground">
        Punching in from the office? Scan the entrance QR instead.
      </p>
    </div>
  );
}
