"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, UserPlus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createUserAction,
  updateUserAction,
  setLeaveBalanceAction,
} from "@/lib/actions/users";
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
  leaveBalances: { leaveType: LeaveType; allocated: number; perMonth: number; used: number }[];
};

type RoleRow = { id: string; name: string };

const LEAVE_TYPES: LeaveType[] = ["REGULAR", "PAID", "COMPENSATORY", "HALF_DAY"];

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

  const reset = () => {
    setName("");
    setEmail("");
    setPassword("");
    setDesignation("");
    setRoleId(roles[0]?.id ?? "");
  };

  const submit = () => {
    startTransition(async () => {
      const res = await createUserAction({ name, email, password, designation, roleId });
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
            Creates a new account with role and designation. The invitee must change their
            password after first sign-in.
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
              <Select value={roleId} onValueChange={(v) => v && setRoleId(v)}>
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
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
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

  const submit = () => {
    startTransition(async () => {
      const res = await updateUserAction(user.id, { name, designation, roleId });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (!exempt) {
        const bal = await setLeaveBalanceAction({
          userId: user.id,
          fiscalYear,
          leaveType: "PAID",
          perMonth: Number(paidPerMonth),
        });
        if (bal.error) {
          toast.error(bal.error);
          return;
        }
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
          <DialogDescription>Update account details and role.</DialogDescription>
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
                <Select value={roleId} onValueChange={(v) => v && setRoleId(v)}>
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
              {!exempt && (
                <Field>
                  <FieldLabel htmlFor="eu-paid">Paid days per month</FieldLabel>
                  <Input
                    id="eu-paid"
                    type="number"
                    step="0.5"
                    min="0"
                    value={paidPerMonth}
                    onChange={(e) => setPaidPerMonth(e.target.value)}
                    required
                  />
                </Field>
              )}
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AllocateLeaveDialog({
  user,
  fiscalYear,
}: {
  user: UserRow;
  fiscalYear: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [leaveType, setLeaveType] = useState<LeaveType>("PAID");
  const [allocated, setAllocated] = useState("0");
  const [perMonth, setPerMonth] = useState("1");

  const balance = user.leaveBalances.find((b) => b.leaveType === leaveType);
  const isPaid = leaveType === "PAID";

  const changeType = (v: string | null) => {
    if (!v) return;
    const t = v as LeaveType;
    setLeaveType(t);
    const b = user.leaveBalances.find((x) => x.leaveType === t);
    setPerMonth(String(b?.perMonth ?? 1));
    setAllocated(String(b?.allocated ?? 0));
  };

  const submit = () => {
    startTransition(async () => {
      const res = await setLeaveBalanceAction({
        userId: user.id,
        fiscalYear,
        leaveType,
        ...(isPaid ? { perMonth: Number(perMonth) } : { allocated: Number(allocated) }),
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Leave balance updated");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setLeaveType("PAID");
          const b = user.leaveBalances.find((x) => x.leaveType === "PAID");
          setPerMonth(String(b?.perMonth ?? 1));
          setAllocated(String(b?.allocated ?? 0));
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" aria-label={`Allocate leave for ${user.name}`}>
            <Wallet />
            Allocate
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Allocate leave — {user.name}</DialogTitle>
          <DialogDescription>
            Set leave entitlement for {fiscalYear}. PAID leave accrues per month; other
            types use an annual lump. Usage is tracked separately.
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
              <FieldLabel>Leave type</FieldLabel>
              <Select value={leaveType} onValueChange={changeType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replaceAll("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {isPaid ? (
              <Field>
                <FieldLabel htmlFor="al-monthly">Paid days per month</FieldLabel>
                <Input
                  id="al-monthly"
                  type="number"
                  step="0.5"
                  min="0"
                  value={perMonth}
                  onChange={(e) => setPerMonth(e.target.value)}
                  required
                />
              </Field>
            ) : (
              <Field>
                <FieldLabel htmlFor="al-allocated">Allocated days (annual)</FieldLabel>
                <Input
                  id="al-allocated"
                  type="number"
                  step="0.5"
                  min="0"
                  value={allocated}
                  onChange={(e) => setAllocated(e.target.value)}
                  required
                />
              </Field>
            )}
            {balance && (
              <p className="text-sm text-muted-foreground">
                Currently{" "}
                {isPaid
                  ? `${balance.perMonth}/mo accruing, ${balance.used} used`
                  : `${balance.allocated} allocated, ${balance.used} used`}
                .
              </p>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
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
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-2">
        <UsersImport roles={assignableRoles} />
        <CreateUserDialog roles={assignableRoles} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Designation</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Leave balance</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">
                {u.name}
                {u.id === currentUserId && (
                  <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                )}
              </TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell>{u.designation ?? "-"}</TableCell>
              <TableCell>
                <Badge variant={u.isSuperAdmin ? "default" : "secondary"}>
                  {u.role?.name ?? (u.isSuperAdmin ? "Super Admin" : "—")}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1.5">
                  {u.leaveBalances.length === 0 && (
                    <span className="text-sm text-muted-foreground">None</span>
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
                  {!isLeaveExempt(u) && <AllocateLeaveDialog user={u} fiscalYear={fiscalYear} />}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}