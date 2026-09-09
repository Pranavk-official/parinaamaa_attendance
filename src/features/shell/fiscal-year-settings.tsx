"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Save, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fiscalYear, fiscalYearRange, type FiscalStart } from "@/lib/domain/fiscal";
import { updateFiscalStartAction } from "@/lib/server/actions/settings";

// Pick any date — only its month and day are remembered. The year repeats.
export function FiscalYearSettings({ start }: { start: FiscalStart }) {
  const router = useRouter();
  const [draft, setDraft] = useState(start);
  const [busy, startTransition] = useTransition();
  const unchanged = draft.month === start.month && draft.day === start.day;

  const save = () => {
    startTransition(async () => {
      const res = await updateFiscalStartAction(draft);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Financial year updated");
      router.refresh();
    });
  };

  const demo = new Date(new Date().getFullYear(), draft.month, draft.day);
  const fy = fiscalYear(new Date(), draft);
  const range = fiscalYearRange(fy, draft);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial year</CardTitle>
        <CardDescription>
          Pick the date the financial year begins — only the month and day are
          remembered, and it repeats every year. Leave balances and statutory
          accruals reset on that date.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <Field>
          <FieldLabel>Starts on</FieldLabel>
          <Popover>
            <PopoverTrigger
              render={
                <Button variant="outline" className="w-56 justify-start font-normal">
                  <CalendarDays />
                  {format(demo, "d MMM")}
                </Button>
              }
            />
            <PopoverContent align="start" className="w-auto p-0" sideOffset={4}>
              <Calendar
                mode="single"
                selected={demo}
                onSelect={(d) => d && setDraft({ month: d.getMonth(), day: d.getDate() })}
                autoFocus
              />
            </PopoverContent>
          </Popover>
          <FieldDescription>
            FY {fy} runs {format(range.start, "d MMM yyyy")} to {format(range.end, "d MMM yyyy")}.
          </FieldDescription>
        </Field>
        <Button onClick={save} disabled={busy || unchanged}>
          {busy ? <Spinner /> : <Save />}
          Save
        </Button>
      </CardContent>
    </Card>
  );
}