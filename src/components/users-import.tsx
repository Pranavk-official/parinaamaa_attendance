"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { CircleCheck, Download, FileUp, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { createUserAction } from "@/lib/actions/users";

type RoleRow = { id: string; name: string };

// One header row plus a filled example, so the shape is obvious in a spreadsheet.
const TEMPLATE = [
  "name,email,password,designation,role,salary,salaryBasis,paidPerMonth,compensatory",
  "Asha Nair,asha@company.local,changeme123,Software Engineer,Employee,85000,monthly,1,0",
].join("\n");

function downloadTemplate(format: "csv" | "xlsx") {
  if (format === "xlsx") {
    // No value in the template contains a comma, so splitting is enough.
    const rows = TEMPLATE.split("\n").map((line) => line.split(","));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Users");
    XLSX.writeFile(book, "users-import-template.xlsx");
    return;
  }
  const url = URL.createObjectURL(
    new Blob([TEMPLATE], { type: "text/csv;charset=utf-8" })
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "users-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

type ParsedRow = {
  name: string;
  email: string;
  password: string;
  designation: string;
  role: string;
  paidPerMonth: number;
  compensatory: number;
  salary: number | null;
  annualSalary: boolean;
};

// Blank cells fall back to the default; anything else must be a real number.
function num(v: unknown, fallback: number): number | null {
  const raw = String(v ?? "").trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function UsersImport({ roles }: { roles: RoleRow[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const roleById = new Map(roles.map((r) => [r.name, r.id]));

  const onFile = async (file: File) => {
    setErrors([]);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
      const parsed: ParsedRow[] = [];
      const errs: string[] = [];
      json.forEach((r, i) => {
        const name = String(r.name ?? "").trim();
        const email = String(r.email ?? "").trim();
        const password = String(r.password ?? "").trim();
        const designation = String(r.designation ?? "").trim();
        const role = String(r.role ?? "Employee").trim();
        const paidPerMonth = num(r.paidPerMonth, 1);
        const compensatory = num(r.compensatory, 0);
        const salaryRaw = String(r.salary ?? "").trim();
        const salary = salaryRaw === "" ? null : num(salaryRaw, 0);
        const annualSalary = /^(annual|ctc|yearly|y)$/i.test(String(r.salaryBasis ?? "").trim());
        if (!name || !email || !password) {
          errs.push(`Row ${i + 2}: name, email, password required`);
          return;
        }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          errs.push(`Row ${i + 2}: invalid email "${email}"`);
          return;
        }
        if (!roleById.has(role)) {
          errs.push(`Row ${i + 2}: unknown role "${role}"`);
          return;
        }
        if (paidPerMonth === null || !Number.isInteger(paidPerMonth)) {
          errs.push(`Row ${i + 2}: paidPerMonth must be a whole number of days`);
          return;
        }
        if (compensatory === null) {
          errs.push(`Row ${i + 2}: compensatory must be a non-negative number`);
          return;
        }
        if (salary === null && salaryRaw !== "") {
          errs.push(`Row ${i + 2}: salary must be a non-negative number`);
          return;
        }
        parsed.push({
          name,
          email,
          password,
          designation,
          role,
          paidPerMonth,
          compensatory,
          salary,
          annualSalary,
        });
      });
      setRows(parsed);
      setErrors(errs);
    } catch {
      setErrors([
        "Could not read file. Use .csv or .xlsx with columns: name, email, password, designation, role, salary, salaryBasis, paidPerMonth, compensatory.",
      ]);
    }
  };

  const importAll = () => {
    if (!rows) return;
    startTransition(async () => {
      let ok = 0;
      const errs: string[] = [];
      for (const r of rows) {
        const res = await createUserAction({
          name: r.name,
          email: r.email,
          password: r.password,
          designation: r.designation,
          roleId: roleById.get(r.role)!,
          leave: { paidPerMonth: r.paidPerMonth, compensatoryAllocated: r.compensatory },
          pay: { salary: r.salary, salaryBasis: r.annualSalary ? "ANNUAL" : "MONTHLY" },
        });
        if (res.error) errs.push(`${r.email}: ${res.error}`);
        else ok++;
      }
      if (errs.length) setErrors(errs);
      toast.success(`Imported ${ok} of ${rows.length} users`);
      setRows(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    });
  };

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) {
      setRows(null);
      setErrors([]);
    }
  };

  // Same body in both containers — only the shell changes with the breakpoint.
  const Header = isMobile ? DrawerHeader : DialogHeader;
  const Title = isMobile ? DrawerTitle : DialogTitle;
  const Description = isMobile ? DrawerDescription : DialogDescription;
  const Footer = isMobile ? DrawerFooter : DialogFooter;
  const Trigger = isMobile ? DrawerTrigger : DialogTrigger;
  const trigger = (
    <Button type="button" variant="outline">
      <FileUp />
      Import users
    </Button>
  );

  const inside = (
    <>
      <Header>
        <Title>Import users</Title>
        <Description>
          Upload a .csv or .xlsx file. Columns: name, email, password, designation,
          role (defaults to Employee), salary, salaryBasis (annual or monthly,
          defaults to monthly), paidPerMonth (defaults to 1), compensatory (defaults
          to 0). Regular leave is unpaid and uncapped, so it is never allocated.
        </Description>
      </Header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Download template:</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadTemplate("xlsx")}
            >
              <Download />
              Excel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadTemplate("csv")}
            >
              <Download />
              CSV
            </Button>
          </div>
          <Input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
            }}
          />
          {rows && (
            <Alert>
              <CircleCheck />
              <AlertTitle>{rows.length} valid user(s) ready to import.</AlertTitle>
            </Alert>
          )}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>
                {errors.length} row(s) could not be read
              </AlertTitle>
              <AlertDescription>
                <ul className="max-h-40 list-inside list-disc overflow-auto">
                  {errors.slice(0, 50).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
      <Footer>
        <Button
          type="button"
          disabled={!rows || rows.length === 0 || pending}
          onClick={importAll}
        >
          {pending && <Spinner />}
          Import {rows?.length ?? 0} users
        </Button>
      </Footer>
    </>
  );

  const rootProps = { open, onOpenChange } as const;

  return isMobile ? (
    <Drawer {...rootProps} showSwipeHandle>
      <Trigger render={trigger} />
      <DrawerContent>{inside}</DrawerContent>
    </Drawer>
  ) : (
    <Dialog {...rootProps}>
      <Trigger render={trigger} />
      <DialogContent>{inside}</DialogContent>
    </Dialog>
  );
}