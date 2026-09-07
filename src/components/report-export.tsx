"use client";

import { useState } from "react";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";

function lastMonthKey() {
  const d = new Date();
  const dt = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

export function ReportExport() {
  const [month, setMonth] = useState(lastMonthKey());
  const href = (format: "csv" | "xlsx") => `/api/export/payroll?format=${format}&month=${month}`;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <Field>
        <FieldLabel htmlFor="report-month">Month</FieldLabel>
        <Input
          id="report-month"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </Field>
      <div className="flex gap-2">
        <Button render={<a href={href("xlsx")} />}>
          <FileSpreadsheet />
          Export XLSX
        </Button>
        <Button variant="outline" render={<a href={href("csv")} />}>
          <FileDown />
          Export CSV
        </Button>
      </div>
    </div>
  );
}