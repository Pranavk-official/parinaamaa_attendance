"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createUserAction, updateUserAction } from "@/lib/actions/users";
import { UsersImport } from "@/components/users-import";
import { isLeaveExempt } from "@/lib/leave-policy";
import type { LeaveType } from "@/generated/prisma/client";

type UserRow = {
  id: string;
  name: string;
  email: string;
  designation: string | null;
  isSuperAdmin: boolean;
  role: { id: string; name: string; permissions: string[] } | null;
  salary: number | null;
  annualSalary: boolean;
  leaveBalances: { leaveType: LeaveType; allocated: number; perMonth: number; used: number }[];
};

type RoleRow = { id: string; name: string; permissions: string[] };

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Salary is either a monthly gross or an annual CTC; payroll derives the rest. */
function SalaryFields({
  idPrefix,
  salary,
  setSalary,
  annual,
  setAnnual,
}: {
  idPrefix: string;
  salary: string;
  setSalary: (v: string) => void;
  annual: boolean;
  setAnnual: (v: boolean) => void;
}) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-salary`}>Salary</FieldLabel>
        <Input
          id={`${idPrefix}-salary`}
          type="number"
          step="0.01"
          min="0"
          value={salary}
          onChange={(e) => setSalary(e.target.value)}
          placeholder="Leave blank if not recorded"
        />
      </Field>
      <Field orientation="horizontal">
        <Checkbox
          id={`${idPrefix}-annual`}
          checked={annual}
          onCheckedChange={(c) => setAnnual(c === true)}
        />
        <FieldLabel htmlFor={`${idPrefix}-annual`} className="font-normal">
          Annual CTC
        </FieldLabel>
      </Field>
      <FieldDescription>
        Unchecked means the figure is a monthly gross. Unpaid leave is deducted at the
        monthly gross divided by the days in the payroll month.
      </FieldDescription>
    </>
  );
}

/** Allocation is per fiscal year; REGULAR is unpaid and uncapped so it has none. */
function LeaveAllocationFields({
  idPrefix,
  paidPerMonth,
  setPaidPerMonth,
  compensatory,
  setCompensatory,
}: {
  idPrefix: string;
  paidPerMonth: string;
  setPaidPerMonth: (v: string) => void;
  compensatory: string;
  setCompensatory: (v: string) => void;
}) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-paid`}>Paid days per month</FieldLabel>
        <Input
          id={`${idPrefix}-paid`}
          type="number"
          step="1"
          min="0"
          value={paidPerMonth}
          onChange={(e) => setPaidPerMonth(e.target.value)}
          required
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-comp`}>Compensatory days (annual)</FieldLabel>
        <Input
          id={`${idPrefix}-comp`}
          type="number"
          step="0.5"
          min="0"
          value={compensatory}
          onChange={(e) => setCompensatory(e.target.value)}
          required
        />
        <FieldDescription>
          Paid leave is allocated in whole days and can be taken half a day at a time.
          Regular leave is unpaid and uncapped, so it is never allocated.
        </FieldDescription>
      </Field>
    </>
  );
}

function CreateUserDialog({
  roles,
}: {
  roles: RoleRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [designation, setDesignation] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [paidPerMonth, setPaidPerMonth] = useState("1");
  const [compensatory, setCompensatory] = useState("0");
  const [salary, setSalary] = useState("");
  const [annual, setAnnual] = useState(false);
  // Staff roles carry permissions; they are leave-exempt and get no allocation.
  const exempt = (roles.find((r) => r.id === roleId)?.permissions.length ?? 0) > 0;

  const reset = () => {
    setName("");
    setEmail("");
    setPassword("");
    setDesignation("");
    setRoleId(roles[0]?.id ?? "");
    setPaidPerMonth("1");
    setCompensatory("0");
    setSalary("");
    setAnnual(false);
  };

  const submit = () => {
    startTransition(async () => {
      const res = await createUserAction({
        name,
        email,
        password,
        designation,
        roleId,
        leave: {
          paidPerMonth: Number(paidPerMonth),
          compensatoryAllocated: Number(compensatory),
        },
        pay: {
          salary: salary.trim() === "" ? null : Number(salary),
          salaryBasis: annual ? "ANNUAL" : "MONTHLY",
        },
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("User created");
      setOpen(false);
      reset();
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <UserPlus />
            Add user
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>
            Creates a new account with role, designation, salary, and leave allocation.
            The invitee must change their password after first sign-in.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nu-name">Name</FieldLabel>
              <Input id="nu-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="nu-email">Email</FieldLabel>
              <Input
                id="nu-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="nu-password">Temporary password</FieldLabel>
              <Input
                id="nu-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="nu-designation">Designation</FieldLabel>
              <Input
                id="nu-designation"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel>Role</FieldLabel>
              <Select
                value={roleId}
                onValueChange={(v) => v && setRoleId(v)}
                items={roles.map((r) => ({ value: r.id, label: r.name }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <SalaryFields
              idPrefix="nu"
              salary={salary}
              setSalary={setSalary}
              annual={annual}
              setAnnual={setAnnual}
            />
            {!exempt && (
              <LeaveAllocationFields
                idPrefix="nu"
                paidPerMonth={paidPerMonth}
                setPaidPerMonth={setPaidPerMonth}
                compensatory={compensatory}
                setCompensatory={setCompensatory}
              />
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  user,
  roles,
  canEdit,
  fiscalYear,
}: {
  user: UserRow;
  roles: RoleRow[];
  canEdit: boolean;
  fiscalYear: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(user.name);
  const [designation, setDesignation] = useState(user.designation ?? "");
  const [roleId, setRoleId] = useState(user.role?.id ?? roles[0]?.id ?? "");
  const exempt = isLeaveExempt(user);
  const [paidPerMonth, setPaidPerMonth] = useState(
    String(user.leaveBalances.find((b) => b.leaveType === "PAID")?.perMonth ?? 1),
  );
  const [compensatory, setCompensatory] = useState(
    String(user.leaveBalances.find((b) => b.leaveType === "COMPENSATORY")?.allocated ?? 0),
  );
  const [salary, setSalary] = useState(user.salary === null ? "" : String(user.salary));
  const [annual, setAnnual] = useState(user.annualSalary);

  const submit = () => {
    startTransition(async () => {
      const res = await updateUserAction(user.id, {
        name,
        designation,
        roleId,
        leave: {
          paidPerMonth: Number(paidPerMonth),
          compensatoryAllocated: Number(compensatory),
        },
        pay: {
          salary: salary.trim() === "" ? null : Number(salary),
          salaryBasis: annual ? "ANNUAL" : "MONTHLY",
        },
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("User updated");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="icon" aria-label={`Edit ${user.name}`}>
            <Pencil />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {user.name}</DialogTitle>
          <DialogDescription>
            Update account details, role, salary, and leave allocation for {fiscalYear}.
          </DialogDescription>
        </DialogHeader>
        {!canEdit ? (
          <p className="text-sm text-muted-foreground">
            Only another super admin can edit this account.
          </p>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="eu-name">Name</FieldLabel>
                <Input id="eu-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="eu-designation">Designation</FieldLabel>
                <Input
                  id="eu-designation"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>Role</FieldLabel>
                <Select
                value={roleId}
                onValueChange={(v) => v && setRoleId(v)}
                items={roles.map((r) => ({ value: r.id, label: r.name }))}
              >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <SalaryFields
                idPrefix="eu"
                salary={salary}
                setSalary={setSalary}
                annual={annual}
                setAnnual={setAnnual}
              />
              {!exempt && (
                <LeaveAllocationFields
                  idPrefix="eu"
                  paidPerMonth={paidPerMonth}
                  setPaidPerMonth={setPaidPerMonth}
                  compensatory={compensatory}
                  setCompensatory={setCompensatory}
                />
              )}
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Spinner />}
                Save
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function UsersPanel({
  currentUserId,
  isSuperAdmin,
  users,
  roles,
  fiscalYear,
}: {
  currentUserId: string;
  isSuperAdmin: boolean;
  users: UserRow[];
  roles: RoleRow[];
  fiscalYear: string;
}) {
  const assignableRoles = isSuperAdmin
    ? roles
    : roles.filter((r) => r.name !== "Super Admin");

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {users.length} account{users.length === 1 ? "" : "s"}
        </CardTitle>
        <CardAction>
          <div className="flex gap-2">
            <UsersImport roles={assignableRoles} />
            <CreateUserDialog roles={assignableRoles} />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="hidden md:table-cell">Designation</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="hidden md:table-cell">Salary</TableHead>
            <TableHead className="hidden lg:table-cell">Leave balance</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">
                {u.name}
                {u.id === currentUserId && (
                  <span className="ml-2 font-normal text-muted-foreground">(you)</span>
                )}
                <span className="block font-normal text-muted-foreground">{u.email}</span>
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">
                {u.designation ?? "—"}
              </TableCell>
              <TableCell>
                <Badge variant={u.isSuperAdmin ? "default" : "secondary"}>
                  {u.role?.name ?? (u.isSuperAdmin ? "Super Admin" : "—")}
                </Badge>
              </TableCell>
              <TableCell className="hidden whitespace-nowrap tabular-nums md:table-cell">
                {u.salary === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <>
                    {money.format(u.salary)}
                    <span className="text-muted-foreground">
                      {u.annualSalary ? " /yr" : " /mo"}
                    </span>
                  </>
                )}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <div className="flex flex-wrap gap-1.5">
                  {u.leaveBalances.length === 0 && (
                    <span className="text-muted-foreground">None</span>
                  )}
                  {u.leaveBalances.map((b) => (
                    <Badge key={b.leaveType} variant="outline">
                      {b.leaveType.replaceAll("_", " ")}{" "}
                      {b.perMonth > 0
                        ? `${b.perMonth}/mo · ${b.used} used`
                        : `${b.used}/${b.allocated}`}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <EditUserDialog
                    user={u}
                    roles={assignableRoles}
                    canEdit={!u.isSuperAdmin || isSuperAdmin}
                    fiscalYear={fiscalYear}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </CardContent>
    </Card>
  );
}