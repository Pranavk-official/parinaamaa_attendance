import { ScrollText } from "lucide-react";
import { mustUser, requirePermission } from "@/lib/auth-user";
import { prisma } from "@/lib/prisma";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PageHeader } from "@/components/page-header";

function jsonSummary(v: unknown): string {
  if (v == null) return "-";
  const s = JSON.stringify(v);
  return s.length > 120 ? `${s.slice(0, 117)}...` : s;
}

export default async function AuditPage() {
  const user = await mustUser();
  requirePermission(user, "view:reports");
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { name: true, email: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Audit Log"
        subtitle="The last 100 attendance and leave-balance changes, newest first."
      />
      <Card>
        <CardHeader>
          <CardTitle>Recent changes</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ScrollText />
                </EmptyMedia>
                <EmptyTitle>No audit entries yet</EmptyTitle>
                <EmptyDescription>
                  Edits to attendance and leave balances are recorded here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table stacked>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="hidden md:table-cell">Entity</TableHead>
                  <TableHead className="hidden lg:table-cell">Old</TableHead>
                  <TableHead className="hidden lg:table-cell">New</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell
                      data-label="When"
                      className="whitespace-nowrap text-muted-foreground"
                    >
                      {l.createdAt.toLocaleString()}
                    </TableCell>
                    <TableCell data-label="Actor" className="font-medium">
                      {l.actor?.name ?? "system"}
                    </TableCell>
                    <TableCell data-label="Action">
                      <Badge variant="secondary">{l.action}</Badge>
                    </TableCell>
                    <TableCell
                      data-label="Entity"
                      data-wrap
                      className="hidden font-mono text-muted-foreground md:table-cell"
                    >
                      {l.entity}:{l.entityId?.slice(0, 8)}
                    </TableCell>
                    <TableCell
                      data-label="Old"
                      data-wrap
                      className="hidden max-w-55 truncate font-mono text-muted-foreground lg:table-cell"
                    >
                      {jsonSummary(l.oldValues)}
                    </TableCell>
                    <TableCell
                      data-label="New"
                      data-wrap
                      className="hidden max-w-55 truncate font-mono text-muted-foreground lg:table-cell"
                    >
                      {jsonSummary(l.newValues)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
