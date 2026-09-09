"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Save, CalendarDays, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { updatePayrollDayAction } from "@/lib/server/actions/settings";

const ordinal = (n: number) =>
  `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["st", "nd", "rd"][(n - 1) % 10] ?? "th"}`;

export function PayrollSettings({ day }: { day: number }) {
  const router = useRouter();
  const [draft, setDraft] = useState(day);
  // Partial range pick: payday = the range's end date once both ends are in.
  const [range, setRange] = useState<{ from: Date; to?: Date } | null>(null);
  const [busy, startTransition] = useTransition();

  // Both pickers land on the same cut-off day: the picked date's day, or the
  // range's end date (that is the payday the period closes on).
  const applyDay = (n: number) => {
    if (n < 1 || n > 28) {
      toast.error("A cut-off day must be between 1 and 28 — pick a different date.");
      return;
    }
    setDraft(n);
  };

  const save = () => {
    startTransition(async () => {
      const res = await updatePayrollDayAction(draft);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Payroll range updated");
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payroll range</CardTitle>
        <CardDescription>
          A payroll month runs from the cut-off day of one month to the day before it next
          month. Pick a date — or a range whose end is payday — to set it. Day 1 is a plain
          calendar month.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <Field>
          <FieldLabel>Cut-off day</FieldLabel>
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger
                render={
                  <Button variant="outline" className="w-56 justify-start font-normal">
                    <CalendarDays />
                    {ordinal(draft)}
                  </Button>
                }
              />
              <PopoverContent align="start" className="w-auto p-0" sideOffset={4}>
                <Calendar
                  mode="single"
                  selected={new Date(new Date().getFullYear(), new Date().getMonth(), draft)}
                  onSelect={(d) => d && applyDay(d.getDate())}
                  autoFocus
                />
              </PopoverContent>
            </Popover>

            <span className="text-sm text-muted-foreground">or</span>

            <Popover>
              <PopoverTrigger
                render={
                  <Button variant="outline" className="w-56 justify-start font-normal">
                    <CalendarRange />
                    {range?.from
                      ? range.to && range.to > range.from
                        ? `${format(range.from, "d MMM")} – ${format(range.to, "d MMM yyyy")}`
                        : "Pick an end date"
                      : "Pick a payday range"}
                  </Button>
                }
              />
              <PopoverContent align="start" className="w-auto p-0" sideOffset={4}>
                <Calendar
                  mode="range"
                  selected={range ? { from: range.from, to: range.to } : undefined}
                  onSelect={(r) => {
                    if (!r?.from) return setRange(null);
                    if (r.to && r.to > r.from) {
                      setRange(null);
                      applyDay(r.to.getDate());
                    } else {
                      setRange({ from: r.from });
                    }
                  }}
                  autoFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <FieldDescription>
            {draft === 1
              ? "Day 1 is a plain calendar month."
              : `Example: the ${ordinal(draft)} means February covers Feb ${draft} to Mar ${draft - 1}.`}
          </FieldDescription>
        </Field>
        <Button onClick={save} disabled={busy || draft === day}>
          {busy ? <Spinner /> : <Save />}
          Save
        </Button>
      </CardContent>
    </Card>
  );
}