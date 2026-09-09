import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrisma() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const AUDITED_MODELS = ["leaveBalance", "attendance", "user"] as const;

function logAudit(
  base: PrismaClient,
  actorId: string | null,
  model: string,
  entityId: string | null,
  action: string,
  oldValues: Prisma.InputJsonValue | undefined,
  newValues: Prisma.InputJsonValue | undefined
) {
  void base.auditLog.create({
    data: {
      actorId,
      action,
      entity: model,
      entityId,
      oldValues,
      newValues,
    },
  });
}

type JsonRecord = Record<string, unknown>;

function auditOperation<T extends { id: string }>(
  base: PrismaClient,
  actorId: string | null,
  model: string,
  entity: T | null,
  action: string,
  newValues: unknown
) {
  if (entity) {
    logAudit(base, actorId, model, entity.id, action, entity as JsonRecord as never, newValues as never);
  }
}

// A Prisma client that writes AuditLog entries whenever LeaveBalance, Attendance,
// or User rows are updated or deleted by the given actor.
export function prismaWithAudit(actorId: string | null) {
  return prisma.$extends({
    query: {
      leaveBalance: {
        async update(ctx) {
          const before = await prisma.leaveBalance.findUnique({ where: ctx.args.where });
          const result = await ctx.query(ctx.args);
          auditOperation(
            prisma,
            actorId,
            "LeaveBalance",
            before,
            "update",
            ctx.args.data
          );
          return result;
        },
        async updateMany(ctx) {
          const rows = await prisma.leaveBalance.findMany({ where: ctx.args.where });
          const result = await ctx.query(ctx.args);
          for (const row of rows) {
            auditOperation(prisma, actorId, "LeaveBalance", row, "updateMany", null);
          }
          return result;
        },
        async delete(ctx) {
          const before = await prisma.leaveBalance.findUnique({ where: ctx.args.where });
          const result = await ctx.query(ctx.args);
          auditOperation(prisma, actorId, "LeaveBalance", before, "delete", null);
          return result;
        },
      },
      attendance: {
        async update(ctx) {
          const before = await prisma.attendance.findUnique({ where: ctx.args.where });
          const result = await ctx.query(ctx.args);
          auditOperation(prisma, actorId, "Attendance", before, "update", ctx.args.data);
          return result;
        },
        async updateMany(ctx) {
          const rows = await prisma.attendance.findMany({ where: ctx.args.where });
          const result = await ctx.query(ctx.args);
          for (const row of rows) {
            auditOperation(prisma, actorId, "Attendance", row, "updateMany", null);
          }
          return result;
        },
        async delete(ctx) {
          const before = await prisma.attendance.findUnique({ where: ctx.args.where });
          const result = await ctx.query(ctx.args);
          auditOperation(prisma, actorId, "Attendance", before, "delete", null);
          return result;
        },
      },
      user: {
        async update(ctx) {
          const before = await prisma.user.findUnique({ where: ctx.args.where });
          const result = await ctx.query(ctx.args);
          auditOperation(prisma, actorId, "User", before, "update", ctx.args.data);
          return result;
        },
        async updateMany(ctx) {
          const rows = await prisma.user.findMany({ where: ctx.args.where });
          const result = await ctx.query(ctx.args);
          for (const row of rows) {
            auditOperation(prisma, actorId, "User", row, "updateMany", null);
          }
          return result;
        },
        async delete(ctx) {
          const before = await prisma.user.findUnique({ where: ctx.args.where });
          const result = await ctx.query(ctx.args);
          auditOperation(prisma, actorId, "User", before, "delete", null);
          return result;
        },
      },
    },
  });
}

export type AuditClient = ReturnType<typeof prismaWithAudit>;

export { Prisma, AUDITED_MODELS };