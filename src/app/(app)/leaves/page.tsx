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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeaveActions } from "@/components/leave-actions";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  PENDING: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
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
  user: { name: string; email: string };
};

function rowFor(l: LeaveRow, canManage: boolean) {
  const days = countDays(l.startDate, l.endDate, l.isHalfDay);
  const isHalf = l.isHalfDay || l.type === "HALF_DAY";
  return (
    <TableRow key={l.id}>
      <TableCell className="whitespace-nowrap">
        {l.type.replaceAll("_", " ")}
        {isHalf && (
          <span className="text-muted-foreground">
            {" "}
            · {l.halfDaySession ? SESSION_LABEL[l.halfDaySession] : "half"}
          </span>
        )}
      </TableCell>
      <TableCell className="font-medium">{l.user.name}</TableCell>
      <TableCell>{l.startDate.toISOString().slice(0, 10)}</TableCell>
      <TableCell>{l.endDate.toISOString().slice(0, 10)}</TableCell>
      <TableCell>{days}</TableCell>
      <TableCell className="max-w-[200px] truncate">{l.reason}</TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANT[l.status]}>{l.status}</Badge>
      </TableCell>
      <TableCell>
        {l.status === "PENDING" && canManage && (
          <LeaveActions id={l.id} name={l.user.name} />
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

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {exempt ? "Leave Queue" : "My Leave"}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {exempt ? "Requests" : "My Requests"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    {exempt ? "No leave requests yet." : "You have no leave requests."}
                  </TableCell>
                </TableRow>
              )}
              {requests.map((l) => rowFor(l, canManage))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}