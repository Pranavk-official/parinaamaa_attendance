"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, startOfWeek, endOfWeek } from "date-fns";
import {
  CalendarDays,
  CalendarRange,
  FileSpreadsheet,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Preset = "today" | "week" | "month" | "custom";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "custom", label: "Custom" },
];

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const monthKey = (d: Date) => format(d, "yyyy-MM");

function toDate(yyyyMmDd: string): Date {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(y, m - 1, d || 1);
}

function isPreset(v: string | undefined): v is Preset {
  return PRESETS.some((p) => p.value === v);
}

/** Concrete period each preset opens with, so the table matches the picker. */
function presetParams(preset: Preset): Record<string, string> {
  const now = new Date();
  switch (preset) {
    case "today": {
      const d = iso(now);
      return { from: d, to: d };
    }
    case "week":
      return {
        from: iso(startOfWeek(now, { weekStartsOn: 1 })),
        to: iso(endOfWeek(now, { weekStartsOn: 1 })),
      };
    case "month":
      return { month: monthKey(now) };
    case "custom":
      return { from: `${monthKey(now)}-01`, to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
  }
}

export function ReportExport({ preset, month, from, to }: { preset?: string; month?: string; from?: string; to?: string }) {
  const router = useRouter();
  // Only range presets build in two clicks; the URL is the source of truth
  // once complete, this holds just the between-clicks partial.
  const [partial, setPartial] = useState<{ from: Date; to?: Date } | null>(null);
  const urlFrom = from && to ? toDate(from) : null;
  const urlTo = from && to ? toDate(to) : null;
  const range = partial ?? (urlFrom ? { from: urlFrom, to: urlTo! } : null);
  const active: Preset = isPreset(preset)
    ? preset
    : from && to
      ? "custom"
      : "month";

  const go = (params: Record<string, string>) =>
    router.replace(`/reports?${new URLSearchParams(params).toString()}`);
  const pickPreset = (p: Preset) => go({ preset: p, ...presetParams(p) });

  const pickerLabel =
    active === "month"
      ? month
        ? format(toDate(month), "MMMM yyyy")
        : "Pick a month"
      : active === "today"
        ? from
          ? format(toDate(from), "EEE d MMM yyyy")
          : "Pick a date"
        : range?.to && range.to > range.from
          ? `${format(range.from, "d MMM")} – ${format(range.to, "d MMM yyyy")}`
          : range?.from
            ? "Pick an end date"
            : "Pick dates";

  const exportHref = (format: "csv" | "xlsx") => {
    const params = new URLSearchParams({ format });
    if (from && to) {
      params.set("from", from);
      params.set("to", to);
    } else if (month) {
      params.set("month", month);
    }
    return `/api/export/payroll?${params}`;
  };

  const onSingle = (d: Date) => go({ preset: "today", from: iso(d), to: iso(d) });
  const onMonth = (d: Date) => go({ preset: "month", month: monthKey(d) });
  const onRange = (r: { from?: Date; to?: Date } | undefined) => {
    if (!r?.from) return setPartial(null);
    if (r.to && r.to > r.from) {
      setPartial(null);
      go({ preset: active, from: iso(r.from), to: iso(r.to) });
    } else {
      setPartial({ from: r.from });
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
      <Field>
        <FieldLabel>Payroll period</FieldLabel>
        <div className="flex flex-col gap-3">
          <ButtonGroup>
            {PRESETS.map((p) => (
              <Button
                key={p.value}
                variant={active === p.value ? "default" : "outline"}
                onClick={() => pickPreset(p.value)}
              >
                {p.label}
              </Button>
            ))}
          </ButtonGroup>

          <Popover>
            <PopoverTrigger
              render={
                <Button variant="outline" className="w-56 justify-start font-normal">
                  {active === "today" ? <CalendarDays /> : <CalendarRange />}
                  {pickerLabel}
                </Button>
              }
            />
            <PopoverContent align="start" className="w-auto p-0" sideOffset={4}>
              {active === "today" ? (
                <Calendar
                  mode="single"
                  selected={from ? toDate(from) : undefined}
                  onSelect={(d) => d && onSingle(d)}
                  autoFocus
                />
              ) : active === "month" ? (
                <Calendar
                  mode="single"
                  selected={month ? toDate(month) : undefined}
                  onSelect={(d) => d && onMonth(d)}
                  autoFocus
                />
              ) : (
                <Calendar
                  mode="range"
                  selected={range ? { from: range.from, to: range.to } : undefined}
                  onSelect={onRange}
                  autoFocus
                />
              )}
            </PopoverContent>
          </Popover>
        </div>
      </Field>
      <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
        <Button render={<a href={exportHref("xlsx")} />} className="flex-1 sm:flex-none">
          <FileSpreadsheet />
          Export XLSX
        </Button>
        <Button variant="outline" render={<a href={exportHref("csv")} />} className="flex-1 sm:flex-none">
          <FileDown />
          CSV
        </Button>
      </div>
    </div>
  );
}