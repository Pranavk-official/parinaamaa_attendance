"use client";

import { useRouter } from "next/navigation";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** How many months back the picker offers. Payroll only ever reaches back a year or so. */
const MONTHS_OFFERED = 24;

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Most recent first, starting at last month — the month payroll actually closes. */
function recentMonths() {
  const now = new Date();
  return Array.from({ length: MONTHS_OFFERED }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1 - i, 1);
    return {
      value: monthKey(d),
      label: d.toLocaleString("en-US", { month: "long", year: "numeric" }),
    };
  });
}

export function ReportExport({ month }: { month: string }) {
  const router = useRouter();
  const months = recentMonths();
  const href = (format: "csv" | "xlsx") => `/api/export/payroll?format=${format}&month=${month}`;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <Field className="sm:max-w-56">
        <FieldLabel htmlFor="report-month">Month</FieldLabel>
        {/* The month lives in the URL so the table below re-renders with it. */}
        <Select
          items={months}
          value={month}
          onValueChange={(v) => v && router.replace(`/reports?month=${v}`)}
        >
          <SelectTrigger id="report-month">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>Payroll period to summarise.</FieldDescription>
      </Field>
      <ButtonGroup className="w-full sm:w-auto *:flex-1">
        <Button render={<a href={href("xlsx")} />}>
          <FileSpreadsheet />
          Export XLSX
        </Button>
        <Button variant="outline" render={<a href={href("csv")} />}>
          <FileDown />
          Export CSV
        </Button>
      </ButtonGroup>
    </div>
  );
}
