"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createUserAction } from "@/lib/actions/users";

type RoleRow = { id: string; name: string };

type ParsedRow = {
  name: string;
  email: string;
  password: string;
  designation: string;
  role: string;
};

export function UsersImport({ roles }: { roles: RoleRow[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
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
        parsed.push({ name, email, password, designation, role });
      });
      setRows(parsed);
      setErrors(errs);
    } catch {
      setErrors(["Could not read file. Use .csv or .xlsx with columns: name, email, password, designation, role."]);
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

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setRows(null);
          setErrors([]);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline">
            <FileUp />
            Import users
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import users</DialogTitle>
          <DialogDescription>
            Upload a .csv or .xlsx file. Columns: name, email, password, designation,
            role (defaults to Employee).
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
            }}
          />
          {rows && (
            <p className="text-sm text-muted-foreground">
              {rows.length} valid user(s) ready to import.
            </p>
          )}
          {errors.length > 0 && (
            <ul className="max-h-40 list-inside list-disc overflow-auto text-sm text-destructive">
              {errors.slice(0, 50).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={!rows || rows.length === 0 || pending}
            onClick={importAll}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Import {rows?.length ?? 0} users
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}