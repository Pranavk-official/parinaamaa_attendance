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
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Preset = "today" | "week" | "month" | "custom";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "custom", label: "Custom" },
];

// Base UI's Select.Value prints the raw value, so the labels live here.
const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1).padStart(2, "0"),
  label: format(new Date(2000, i, 1), "LLLL"),
}));

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

  // A month is two list choices, not a day on a grid.
  const [monthYear, monthNo] = (month ?? monthKey(new Date())).split("-");
  const thisYear = new Date().getFullYear();
  const years = [
    ...new Set([...Array.from({ length: 6 }, (_, i) => String(thisYear - i)), monthYear]),
  ].sort((a, b) => Number(b) - Number(a));

  const pickerLabel =
    active === "today"
      ? from
        ? format(toDate(from), "EEE d MMM yyyy")
        : "Pick a date"
      : range?.to && range.to > range.from
        ? `${format(range.from, "d MMM")} – ${format(range.to, "d MMM yyyy")}`
        : range?.from
          ? "Pick an end date"
          : "Pick dates";

  const exportHref = (kind: "csv" | "xlsx") => {
    const params = new URLSearchParams({ format: kind });
    if (from && to) {
      params.set("from", from);
      params.set("to", to);
    } else if (month) {
      params.set("month", month);
    }
    return `/api/export/payroll?${params}`;
  };

  const onSingle = (d: Date) => go({ preset: "today", from: iso(d), to: iso(d) });
  // Week is one click: any day snaps to its Mon-Sun week.
  const onWeek = (d: Date) =>
    go({
      preset: "week",
      from: iso(startOfWeek(d, { weekStartsOn: 1 })),
      to: iso(endOfWeek(d, { weekStartsOn: 1 })),
    });
  const onMonth = (key: string) => go({ preset: "month", month: key });
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
      <FieldSet className="gap-3">
        <FieldLegend variant="label" className="mb-0">
          Payroll period
        </FieldLegend>
        <ToggleGroup
          variant="outline"
          spacing={0}
          value={[active]}
          onValueChange={([p]) => isPreset(p) && pickPreset(p)}
          aria-label="Payroll period preset"
        >
          {PRESETS.map((p) => (
            <ToggleGroupItem key={p.value} value={p.value}>
              {p.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {active === "month" ? (
          <ButtonGroup>
            <Select value={monthNo} onValueChange={(v) => v && onMonth(`${monthYear}-${v}`)}>
              <SelectTrigger className="w-36" aria-label="Month">
                <SelectValue>{(v: string) => MONTHS[Number(v) - 1]?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={monthYear} onValueChange={(v) => v && onMonth(`${v}-${monthNo}`)}>
              <SelectTrigger className="w-24" aria-label="Year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ButtonGroup>
        ) : (
          <Popover>
            <PopoverTrigger
              render={
                <Button variant="outline" className="w-60 justify-start font-normal">
                  {active === "today" ? <CalendarDays /> : <CalendarRange />}
                  {pickerLabel}
                </Button>
              }
            />
            <PopoverContent align="start" className="w-auto p-0" sideOffset={4}>
              {active === "custom" ? (
                <Calendar
                  mode="range"
                  selected={range ? { from: range.from, to: range.to } : undefined}
                  onSelect={onRange}
                  autoFocus
                />
              ) : (
                <Calendar
                  mode="single"
                  showWeekNumber={active === "week"}
                  selected={range?.from ?? (from ? toDate(from) : undefined)}
                  onSelect={(d) => d && (active === "week" ? onWeek(d) : onSingle(d))}
                  autoFocus
                />
              )}
            </PopoverContent>
          </Popover>
        )}
      </FieldSet>

      <ButtonGroup className="w-full sm:ml-auto sm:w-auto">
        <Button render={<a href={exportHref("xlsx")} />} className="flex-1 sm:flex-none">
          <FileSpreadsheet />
          Export XLSX
        </Button>
        <Button variant="outline" render={<a href={exportHref("csv")} />} className="flex-1 sm:flex-none">
          <FileDown />
          CSV
        </Button>
      </ButtonGroup>
    </div>
  );
}
