"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { differenceInCalendarDays, format } from "date-fns";
import { toast } from "sonner";
import { CalendarHeart, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { deleteHolidayAction, saveHolidayAction } from "@/lib/server/actions/settings";

/** `date` is "YYYY-MM-DD", the IST calendar day. */
export type Holiday = { id: string; date: string; name: string };

// Local midnight, so the day-picker cell and the stored day always agree.
const toDay = (iso: string) => new Date(`${iso}T00:00:00`);
const toIso = (d: Date) => format(d, "yyyy-MM-dd");

// Red, as on a printed calendar, plus weight and underline so a holiday never
// reads by colour alone. Read-only calendars render plain cells, pickers render
// buttons; style both.
const holidayCell =
  "font-semibold text-destructive underline underline-offset-4 [&_button]:font-semibold [&_button]:text-destructive [&_button]:underline [&_button]:underline-offset-4";

function fromToday(today: string, date: string) {
  const n = differenceInCalendarDays(toDay(date), toDay(today));
  return n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`;
}

function HolidayList({
  holidays,
  today,
  onPick,
  onDelete,
  busyId,
}: {
  holidays: Holiday[];
  today?: string;
  onPick: (h: Holiday) => void;
  onDelete?: (h: Holiday) => void;
  busyId?: string | null;
}) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {holidays.map((h) => (
        <li key={h.id} className="flex items-center gap-2 py-1.5">
          <Button
            variant="ghost"
            className="h-auto min-h-11 min-w-0 flex-1 justify-start gap-3 px-2 text-left font-normal whitespace-normal"
            onClick={() => onPick(h)}
          >
            <Badge
              variant="outline"
              className="w-16 shrink-0 justify-center border-destructive/40 text-destructive tabular-nums"
            >
              {format(toDay(h.date), "d MMM")}
            </Badge>
            <span className="flex min-w-0 flex-col">
              <span className="break-words">{h.name}</span>
              <span className="text-xs text-muted-foreground">
                {format(toDay(h.date), "EEEE")}
                {today && h.date >= today && ` · ${fromToday(today, h.date)}`}
              </span>
            </span>
          </Button>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove ${h.name}`}
              disabled={busyId === h.id}
              onClick={() => onDelete(h)}
            >
              {busyId === h.id ? <Spinner /> : <Trash2 />}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

function NoHolidays({ hint }: { hint: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CalendarHeart />
        </EmptyMedia>
        <EmptyTitle>No holidays</EmptyTitle>
        <EmptyDescription>{hint}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/** Read-only calendar for the dashboard: holidays marked, upcoming ones listed. */
export function HolidayCalendar({ holidays, today }: { holidays: Holiday[]; today: string }) {
  const [month, setMonth] = useState(() => toDay(today));
  const upcoming = holidays.filter((h) => h.date >= today).slice(0, 6);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Holiday calendar</CardTitle>
        <CardDescription>Office closed. Working these days earns compensatory leave.</CardDescription>
      </CardHeader>
      {/* Container query: the card sits in a half-width column on wide screens. */}
      <CardContent className="@container">
        <div className="grid gap-4 @lg:grid-cols-[auto_1fr]">
          <Calendar
            month={month}
            onMonthChange={setMonth}
            today={toDay(today)}
            modifiers={{ holiday: holidays.map((h) => toDay(h.date)) }}
            modifiersClassNames={{ holiday: holidayCell }}
            className="mx-auto [--cell-size:--spacing(9)]"
          />
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium">Upcoming</p>
            {upcoming.length === 0 ? (
              <NoHolidays hint="Nothing scheduled ahead." />
            ) : (
              <HolidayList holidays={upcoming} today={today} onPick={(h) => setMonth(toDay(h.date))} />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Admin editor: pick a day, name it, save. Picking an existing holiday renames it. */
export function HolidaySettings({ holidays, today }: { holidays: Holiday[]; today: string }) {
  const router = useRouter();
  const [date, setDate] = useState<Date | undefined>();
  const [month, setMonth] = useState(() => toDay(today));
  const [name, setName] = useState("");
  const [busy, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const existing = date && holidays.find((h) => h.date === toIso(date));

  const pick = (d: Date | undefined) => {
    setDate(d);
    setName((d && holidays.find((h) => h.date === toIso(d))?.name) ?? "");
  };

  const save = () => {
    if (!date) return;
    startTransition(async () => {
      const res = await saveHolidayAction({ date: toIso(date), name });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(existing ? "Holiday renamed" : "Holiday added");
      pick(undefined);
      router.refresh();
    });
  };

  const remove = (h: Holiday) => {
    setBusyId(h.id);
    startTransition(async () => {
      await deleteHolidayAction(h.id);
      setBusyId(null);
      toast.success(`${h.name} removed`);
      if (date && toIso(date) === h.date) pick(undefined);
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Holidays</CardTitle>
        <CardDescription>
          Company holidays. A punch-in on one is recorded as off-day work and earns
          compensatory leave, same as a weekend.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-[auto_1fr]">
        <div className="flex flex-col gap-4">
          <Calendar
            mode="single"
            selected={date}
            onSelect={pick}
            month={month}
            onMonthChange={setMonth}
            modifiers={{ holiday: holidays.map((h) => toDay(h.date)) }}
            modifiersClassNames={{ holiday: holidayCell }}
            className="mx-auto [--cell-size:--spacing(9)]"
          />
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <Field>
              <FieldLabel htmlFor="holiday-name">
                {date ? format(date, "EEEE, d MMMM yyyy") : "Pick a date above"}
              </FieldLabel>
              <Input
                id="holiday-name"
                placeholder="e.g. Diwali"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!date}
                maxLength={80}
              />
              {existing && <FieldDescription>Already a holiday — saving renames it.</FieldDescription>}
            </Field>
            <Button type="submit" disabled={busy || !date || !name.trim()}>
              {busy && !busyId ? <Spinner /> : <Plus />}
              {existing ? "Rename holiday" : "Add holiday"}
            </Button>
          </form>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-sm font-medium">{holidays.length} scheduled</p>
          {holidays.length === 0 ? (
            <NoHolidays hint="Pick a date on the calendar to add one." />
          ) : (
            <HolidayList
              holidays={holidays}
              today={today}
              onPick={(h) => {
                setMonth(toDay(h.date));
                pick(toDay(h.date));
              }}
              onDelete={remove}
              busyId={busyId}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
