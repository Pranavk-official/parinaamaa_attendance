"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Pencil, Search, Trash2, UserPlus, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { ResponsiveConfirm } from "@/features/shell/responsive-confirm";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { createUserAction, updateUserAction, deleteUserAction, resetUserPasswordAction, setBlockedAction } from "@/lib/server/actions/users";
import { UsersImport } from "@/features/users/users-import";
import { isLeaveExempt } from "@/lib/domain/leave-policy";
import type { LeaveType, SalaryBasis } from "@/generated/prisma/client";

type SalaryHistoryRow = {
  salary: number | null;
  basis: SalaryBasis;
  createdAt: Date;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  designation: string | null;
  isSuperAdmin: boolean;
  isBlocked: boolean;
  joinedDate: string | null;
  relievingDate: string | null;
  role: { id: string; name: string; permissions: string[] } | null;
  salary: number | null;
  annualSalary: boolean;
  leaveBalances: { leaveType: LeaveType; allocated: number; perMonth: number; used: number }[];
  salaryHistory: SalaryHistoryRow[];
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
  const isMobile = useIsMobile();
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
  const [joinedDate, setJoinedDate] = useState("");
  const [relievingDate, setRelievingDate] = useState("");
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
    setJoinedDate("");
    setRelievingDate("");
  };

  const submit = () => {
    startTransition(async () => {
      const res = await createUserAction({
        name,
        email,
        password,
        designation,
        roleId,
        joinedDate: joinedDate || null,
        relievingDate: relievingDate || null,
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

  // Drawer (swipeable bottom sheet) on phones, centered modal on desktop. Same
  // form both ways — only the container changes with the breakpoint.
  const Header = isMobile ? DrawerHeader : DialogHeader;
  const Footer = isMobile ? DrawerFooter : DialogFooter;
  const Title = isMobile ? DrawerTitle : DialogTitle;
  const Description = isMobile ? DrawerDescription : DialogDescription;
  const Trigger = isMobile ? DrawerTrigger : DialogTrigger;

  const inside = (
    <>
      <Header>
        <Title>Add user</Title>
        <Description>
          Creates a new account with role, designation, salary, and leave allocation.
          The invitee must change their password after first sign-in.
        </Description>
      </Header>
      <form className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
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
            <FieldLabel htmlFor="nu-joined">Joined date</FieldLabel>
            <Input
              id="nu-joined"
              type="date"
              value={joinedDate}
              onChange={(e) => setJoinedDate(e.target.value)}
            />
            <FieldDescription>
              Blank means leave accrues from the fiscal start; a set date pro-rates it.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="nu-relieving">Relieving date</FieldLabel>
            <Input
              id="nu-relieving"
              type="date"
              value={relievingDate}
              min={joinedDate || undefined}
              onChange={(e) => setRelievingDate(e.target.value)}
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
      </form>
      <Footer>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="button" disabled={pending} onClick={submit}>
          {pending && <Spinner />}
          Create
        </Button>
      </Footer>
    </>
  );

  const rootProps = {
    open,
    onOpenChange: setOpen,
  } as const;

  return isMobile ? (
    <Drawer {...rootProps} showSwipeHandle>
      <Trigger render={<Button><UserPlus />Add user</Button>} />
      <DrawerContent>{inside}</DrawerContent>
    </Drawer>
  ) : (
    <Dialog {...rootProps}>
      <Trigger render={<Button><UserPlus />Add user</Button>} />
      <DialogContent>{inside}</DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  user,
  roles,
  canEdit,
  canBlock,
  fiscalYear,
}: {
  user: UserRow;
  roles: RoleRow[];
  canEdit: boolean;
  canBlock: boolean;
  fiscalYear: string;
}) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
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
  const [newPassword, setNewPassword] = useState("");
  const [joinedDate, setJoinedDate] = useState(user.joinedDate ?? "");
  const [relievingDate, setRelievingDate] = useState(user.relievingDate ?? "");

  const submit = () => {
    startTransition(async () => {
      const res = await updateUserAction(user.id, {
        name,
        designation,
        roleId,
        joinedDate: joinedDate || null,
        relievingDate: relievingDate || null,
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

  const resetOnly = () => {
    if (!newPassword) return;
    startTransition(async () => {
      const pw = await resetUserPasswordAction(user.id, newPassword);
      if (pw.error) {
        toast.error(pw.error);
        return;
      }
      toast.success(`Password set for ${user.name}`);
      setNewPassword("");
    });
  };

  const toggleBlock = () => {
    startTransition(async () => {
      const res = await setBlockedAction(user.id, !user.isBlocked);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(user.isBlocked ? `${user.name} unblocked` : `${user.name} blocked`);
      router.refresh();
    });
  };

  // Drawer bottom-sheet on phones, right off-canvas sheet on desktop. Same
  // form both ways — only the container and header/footer change.
  const Header = isMobile ? DrawerHeader : SheetHeader;
  const Footer = isMobile ? DrawerFooter : SheetFooter;
  const Title = isMobile ? DrawerTitle : SheetTitle;
  const Description = isMobile ? DrawerDescription : SheetDescription;
  const Trigger = isMobile ? DrawerTrigger : SheetTrigger;

  const inside = (
    <>
      <Header>
        <Title>Edit {user.name}</Title>
        <Description>
          Update account details, role, salary, and leave allocation for {fiscalYear}.
        </Description>
      </Header>
      {!canEdit ? (
        <p className="text-sm text-muted-foreground">
          Only another super admin can edit this account.
        </p>
      ) : (
        <form className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
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
              <FieldLabel htmlFor="eu-joined">Joined date</FieldLabel>
              <Input
                id="eu-joined"
                type="date"
                value={joinedDate}
                onChange={(e) => setJoinedDate(e.target.value)}
              />
              <FieldDescription>
                Blank means leave accrues from the fiscal start; a set date pro-rates it.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="eu-relieving">Relieving date</FieldLabel>
              <Input
                id="eu-relieving"
                type="date"
                value={relievingDate}
                min={joinedDate || undefined}
                onChange={(e) => setRelievingDate(e.target.value)}
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
        </form>
      )}
      {/* Standalone reset: visible on every account dialog, including Admin and
          Super Admin rows where profile editing is locked. The server action
          still enforces "only super admins reset a super admin". */}
      <div className="border-t p-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="eu-new-password">Set password</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="eu-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                placeholder="Min 8 characters"
                autoComplete="new-password"
              />
              <Button
                type="button"
                variant="outline"
                disabled={pending || !newPassword}
                onClick={resetOnly}
              >
                {pending && <Spinner />}
                Set
              </Button>
            </div>
            <FieldDescription>
              Signs {user.name} out everywhere. Super admin passwords can only be
              set by another super admin.
            </FieldDescription>
          </Field>
          {canBlock && (
            <Field>
              <FieldLabel>Access</FieldLabel>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={user.isBlocked ? "default" : "destructive"}
                  disabled={pending}
                  onClick={toggleBlock}
                >
                  {pending && <Spinner />}
                  {user.isBlocked ? "Unblock" : "Block"}
                </Button>
                {user.isBlocked && (
                  <span className="text-sm text-muted-foreground">
                    Blocked — cannot sign in.
                  </span>
                )}
              </div>
              <FieldDescription>
                Blocking signs {user.name} out and stops future sign-ins.
              </FieldDescription>
            </Field>
          )}
        </FieldGroup>
      </div>
      <Footer>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        {canEdit && (
          <Button
            type="button"
            disabled={pending}
            onClick={() => (isMobile ? setConfirmOpen(true) : submit())}
          >
            {pending && <Spinner />}
            Save
          </Button>
        )}
      </Footer>
    </>
  );

  const rootProps = {
    open,
    onOpenChange: setOpen,
  } as const;

  const editTrigger = (
    <Button variant="outline" size="icon" aria-label={`Edit ${user.name}`}>
      <Pencil />
    </Button>
  );

  return isMobile ? (
    <Drawer {...rootProps} showSwipeHandle>
      <Trigger render={editTrigger} />
      <DrawerContent>
        {inside}
        <Drawer open={confirmOpen} onOpenChange={setConfirmOpen} modal>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Save changes?</DrawerTitle>
              <DrawerDescription>
                Update {user.name}&apos;s account, role, salary, and leave allocation.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button type="button" disabled={pending} onClick={submit}>
                {pending && <Spinner />}
                Confirm
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </DrawerContent>
    </Drawer>
  ) : (
    <Sheet {...rootProps}>
      <Trigger render={editTrigger} />
      <SheetContent>{inside}</SheetContent>
    </Sheet>
  );
}

function DeleteUserButton({
  user,
  canDelete,
}: {
  user: UserRow;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  if (!canDelete) return null;

  const remove = () => {
    setOpen(false);
    startTransition(async () => {
      const res = await deleteUserAction(user.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("User deleted");
      router.refresh();
    });
  };

  return (
    <>
      <Button
        size="icon"
        variant="outline"
        disabled={pending}
        aria-label={`Delete ${user.name}`}
        onClick={() => setOpen(true)}
      >
        {pending ? <Spinner /> : <Trash2 />}
      </Button>
      <ResponsiveConfirm
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${user.name}?`}
        description="This permanently removes the account and all associated data including sessions, attendance records, and leave history. This cannot be undone."
        cancelDisabled={pending}
        actions={
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => {
              setOpen(false);
              remove();
            }}
          >
            Delete
          </Button>
        }
      />
    </>
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
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const assignableRoles = isSuperAdmin
    ? roles
    : roles.filter((r) => r.name !== "Super Admin");

  // Non-super-admins cannot see or manage super admin accounts.
  const visible = isSuperAdmin ? users : users.filter((u) => !u.isSuperAdmin);

  const needle = query.trim().toLowerCase();
  const shown = visible.filter((u) => {
    if (roleFilter !== "all" && u.role?.id !== roleFilter) return false;
    if (!needle) return true;
    return [u.name, u.email, u.designation, u.role?.name]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });

  // Every visible account's salary records, newest first, for the admin view.
  const history = visible
    .flatMap((u) => u.salaryHistory.map((h) => ({ ...h, user: u })))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <Tabs defaultValue="accounts">
      <TabsList className="w-full">
        <TabsTrigger value="accounts">Accounts</TabsTrigger>
        <TabsTrigger value="salary-history">Salary History</TabsTrigger>
      </TabsList>
      <TabsContent value="accounts" className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>
              {needle || roleFilter !== "all"
                ? `${shown.length} of ${visible.length}`
                : visible.length}{" "}
              account{visible.length === 1 ? "" : "s"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
        {/* Search and the two create paths share a row from sm up; on a phone
            they stack, because three controls do not fit next to a title. */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <InputGroup className="sm:max-w-72">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              placeholder="Search name, email, designation"
              aria-label="Search accounts"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </InputGroup>
          <Select
            value={roleFilter}
            onValueChange={(v) => setRoleFilter(v ?? "all")}
            items={[
              { value: "all", label: "All roles" },
              ...assignableRoles.map((r) => ({ value: r.id, label: r.name })),
            ]}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {assignableRoles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2 sm:ml-auto sm:flex">
            <UsersImport roles={assignableRoles} />
            <CreateUserDialog roles={assignableRoles} />
          </div>
        </div>

        {shown.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersRound />
              </EmptyMedia>
              <EmptyTitle>No matching accounts</EmptyTitle>
              <EmptyDescription>
                {needle
                  ? `Nothing matches "${query.trim()}". Try a different search.`
                  : "No accounts match the selected filter."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table stacked>
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
              {shown.map((u) => (
                <TableRow key={u.id}>
                  <TableCell data-label="Name" className="font-medium">
                    {u.name}
                    {u.id === currentUserId && (
                      <span className="ml-2 font-normal text-muted-foreground">(you)</span>
                    )}
                    <span className="block font-normal text-muted-foreground">{u.email}</span>
                  </TableCell>
                  <TableCell
                    data-label="Designation"
                    className="hidden text-muted-foreground md:table-cell"
                  >
                    {u.designation ?? "—"}
                  </TableCell>
                  <TableCell data-label="Role">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={u.isSuperAdmin ? "default" : "secondary"}>
                        {u.role?.name ?? (u.isSuperAdmin ? "Super Admin" : "—")}
                      </Badge>
                      {u.relievingDate && <Badge variant="outline">Exited</Badge>}
                      {u.isBlocked && <Badge variant="destructive">Blocked</Badge>}
                    </div>
                  </TableCell>
                  <TableCell
                    data-label="Salary"
                    className="hidden whitespace-nowrap tabular-nums md:table-cell"
                  >
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
                  <TableCell data-label="Leave" data-wrap className="hidden lg:table-cell">
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
                        canBlock={u.id !== currentUserId && (!u.isSuperAdmin || isSuperAdmin)}
                        fiscalYear={fiscalYear}
                      />
                      <DeleteUserButton
                        user={u}
                        canDelete={u.id !== currentUserId && (!u.isSuperAdmin || isSuperAdmin)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="salary-history" className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>
              {history.length} salary record{history.length === 1 ? "" : "s"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <UsersRound />
                  </EmptyMedia>
                  <EmptyTitle>No salary history yet</EmptyTitle>
                  <EmptyDescription>
                    Salary changes will appear here as they are recorded.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table stacked>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Salary</TableHead>
                    <TableHead className="text-right">Changed on</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h, i) => (
                    <TableRow key={i}>
                      <TableCell data-label="Employee" className="font-medium">
                        {h.user.name}
                        <span className="block font-normal text-muted-foreground">
                          {h.user.email}
                        </span>
                      </TableCell>
                      <TableCell
                        data-label="Salary"
                        className="whitespace-nowrap tabular-nums"
                      >
                        {h.salary === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <>
                            {money.format(h.salary)}
                            <span className="text-muted-foreground">
                              {h.basis === "ANNUAL" ? " /yr" : " /mo"}
                            </span>
                          </>
                        )}
                      </TableCell>
                      <TableCell
                        data-label="Changed on"
                        className="text-right text-muted-foreground"
                      >
                        {format(new Date(h.createdAt), "d MMM yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
