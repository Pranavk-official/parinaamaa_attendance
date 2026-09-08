import Link from "next/link";
import { CalendarPlus, Inbox } from "lucide-react";
import { mustUser, hasPermission } from "@/lib/auth-user";
import { prisma } from "@/lib/prisma";
import { countDays } from "@/lib/fiscal";
import { isLeaveExempt } from "@/lib/leave-policy";
import type { HalfDaySession } from "@/generated/prisma/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PageHeader } from "@/components/page-header";
import { LeaveActions, LeaveDelete } from "@/components/leave-actions";

/** Status carries its own label, so colour here is reinforcement, not the signal. */
const STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  APPROVED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  REJECTED: "bg-destructive/15 text-destructive",
};

const SESSION_LABEL: Record<HalfDaySession, string> = {
  MORNING: "morning",
  AFTERNOON: "afternoon",
};

type LeaveRow = {
  id: string;
  type: string;
  startDate: Date;
  endDate: Date;
  isHalfDay: boolean;
  halfDaySession: HalfDaySession | null;
  status: string;
  reason: string;
  userId: string;
  user: { name: string; email: string };
};

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function rowFor(l: LeaveRow, canManage: boolean, showEmployee: boolean, viewerId: string) {
  const days = countDays(l.startDate, l.endDate, l.isHalfDay);
  return (
    <TableRow key={l.id}>
      <TableCell className="whitespace-nowrap font-medium">
        {l.type.replaceAll("_", " ")}
        {l.isHalfDay && (
          <span className="font-normal text-muted-foreground">
            {" "}
            · {l.halfDaySession ? SESSION_LABEL[l.halfDaySession] : "half"}
          </span>
        )}
      </TableCell>
      {showEmployee && <TableCell>{l.user.name}</TableCell>}
      <TableCell className="text-muted-foreground">
        {iso(l.startDate)}
        <span className="md:hidden"> → {iso(l.endDate)}</span>
      </TableCell>
      <TableCell className="hidden text-muted-foreground md:table-cell">
        {iso(l.endDate)}
      </TableCell>
      <TableCell className="text-right tabular-nums">{days}</TableCell>
      <TableCell className="hidden max-w-[220px] truncate text-muted-foreground lg:table-cell">
        {l.reason}
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className={STATUS_CLASS[l.status]}>
          {l.status}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        {l.status === "PENDING" && (
          <div className="flex items-center justify-end gap-2">
            {canManage && (
              <LeaveActions
                id={l.id}
                name={l.user.name}
                type={l.type}
                startDate={iso(l.startDate)}
                endDate={iso(l.endDate)}
                days={days}
              />
            )}
            {/* Own request, or a manager tidying the queue. */}
            {(l.userId === viewerId || canManage) && <LeaveDelete id={l.id} />}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

export default async function LeavesPage() {
  const user = await mustUser();
  const canManage = hasPermission(user, "manage:leaves");
  const exempt = isLeaveExempt(user);

  // Employees see only their own requests; admins see the whole team queue.
  const requests = await prisma.leaveRequest.findMany({
    where: exempt ? {} : { userId: user.id },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const pending = requests.filter((r) => r.status === "PENDING").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={exempt ? "Leave Queue" : "My Leave"}
        subtitle={
          exempt
            ? `${pending} request${pending === 1 ? "" : "s"} awaiting a decision`
            : "Your last 30 requests and where each one stands."
        }
      >
        {!exempt && (
          <Button render={<Link href="/leaves/new" />}>
            <CalendarPlus />
            Apply leave
          </Button>
        )}
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>{exempt ? "Requests" : "My requests"}</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Inbox />
                </EmptyMedia>
                <EmptyTitle>{exempt ? "No requests yet" : "Nothing requested yet"}</EmptyTitle>
                <EmptyDescription>
                  {exempt
                    ? "Leave requests land here as soon as staff submit them."
                    : "Requests you submit show up here with their status."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  {exempt && <TableHead>Employee</TableHead>}
                  <TableHead>Start</TableHead>
                  <TableHead className="hidden md:table-cell">End</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                  <TableHead className="hidden lg:table-cell">Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{requests.map((l) => rowFor(l, canManage, exempt, user.id))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
