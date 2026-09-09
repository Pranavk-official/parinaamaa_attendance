"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ResponsiveConfirm } from "@/features/shell/responsive-confirm";
import { QrScanner } from "@/features/attendance/qr-scanner";
import { wfhPunchInAction, punchOutAction } from "@/lib/server/actions/attendance";
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
      <ResponsiveConfirm
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        cancelDisabled={pending}
        actions={
          <Button
            disabled={pending}
            onClick={() => {
              setOpen(false);
              run();
            }}
          >
            {pending && <Spinner />}
            {label}
          </Button>
        }
      />
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // The props come from the server, so the card would otherwise keep showing
  // the pre-punch state until the refresh lands — on a phone that reads as a
  // missing button. The punch itself already told us the answer.
  const [punched, setPunched] = useState<{
    type: AttendanceType | null;
    punchedOut: boolean;
  } | null>(null);
  const today = punched ?? { type, punchedOut };

  // Punched in already (WFO from the office QR, or WFH here): the only
  // remaining action is punching out. Never offer a second punch-in.
  if (today.type) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{TYPE_LABEL[today.type]}</p>
        {!today.punchedOut && (
          <PunchButton
            label="Punch Out"
            variant="outline"
            title="Punch out for today?"
            description={
              today.type === "OFFDAY_WORK"
                ? "Closes the day and credits your compensatory leave. You cannot punch back in."
                : "Closes the day; you cannot punch back in. Before 2:00 PM it counts as a half day and the afternoon goes to your manager."
            }
            pending={pending}
            run={() =>
              startTransition(async () => {
                const res = await punchOutAction();
                if (res.error) {
                  toast.error(res.error);
                  return;
                }
                setPunched({ type: today.type, punchedOut: true });
                router.refresh();
                if (res.halfDay) {
                  toast.success(
                    "Punched out — half day recorded, sent to your manager for approval."
                  );
                } else if (res.compensatoryEarned) {
                  toast.success(
                    `Punched out — ${res.compensatoryEarned} compensatory day${
                      res.compensatoryEarned === 1 ? "" : "s"
                    } earned.`
                  );
                } else {
                  toast.success("Punched out");
                }
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
        description="Today is recorded as working from home and cannot be changed."
        pending={pending}
        run={() =>
          startTransition(async () => {
            const res = await wfhPunchInAction();
            if (res.error) {
              toast.error(res.error);
              return;
            }
            setPunched({ type: res.type ?? "WFH", punchedOut: false });
            router.refresh();
            toast.success(`Punched in (${res.type})`);
          })
        }
      />
      {/* Already signed in: scanning the entrance QR punches in for WFO without
          a trip through the login page. */}
      <QrScanner />
    </div>
  );
}
