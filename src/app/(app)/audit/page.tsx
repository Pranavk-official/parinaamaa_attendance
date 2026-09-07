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
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent changes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Old</TableHead>
                <TableHead>New</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {l.createdAt.toLocaleString()}
                  </TableCell>
                  <TableCell>{l.actor?.name ?? "system"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{l.action}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {l.entity}:{l.entityId?.slice(0, 8)}
                  </TableCell>
                  <TableCell className="max-w-55 truncate text-xs text-muted-foreground">
                    {l.oldValues ? jsonSummary(l.oldValues) : "-"}
                  </TableCell>
                  <TableCell className="max-w-55 truncate text-xs text-muted-foreground">
                    {l.newValues ? jsonSummary(l.newValues) : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No audit entries yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}