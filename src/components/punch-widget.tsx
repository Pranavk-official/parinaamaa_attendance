"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { wfhPunchInAction, punchOutAction } from "@/lib/actions/attendance";

export function PunchWidget({
  punchedIn,
  punchedOut,
}: {
  punchedIn: boolean;
  punchedOut: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      {!punchedIn && (
        <Button
          className="w-full"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await wfhPunchInAction();
              if (res.error) toast.error(res.error);
              else toast.success(`Punched in (${res.type})`);
            })
          }
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          Punch In (WFH)
        </Button>
      )}
      {punchedIn && !punchedOut && (
        <Button
          variant="outline"
          className="w-full"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await punchOutAction();
              if (res.error) toast.error(res.error);
              else toast.success("Punched out");
            })
          }
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          Punch Out
        </Button>
      )}
    </div>
  );
}