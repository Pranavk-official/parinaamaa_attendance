"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma, prismaWithAudit } from "@/lib/prisma";
import { mustUser, requirePermission } from "@/lib/auth-user";
import type { LeaveType } from "@/generated/prisma/client";

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  designation: string;
  roleId: string;
};

function assertAssignableRole(actor: { isSuperAdmin: boolean }, role: { name: string }) {
  if (role.name === "Super Admin" && !actor.isSuperAdmin) {
    return "Only super admins can assign the Super Admin role";
  }
  return null;
}

export async function createUserAction(input: CreateUserInput) {
  const actor = await mustUser();
  requirePermission(actor, "manage:users");

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { error: "Name is required" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Invalid email" };
  if (input.password.length < 8) return { error: "Password must be at least 8 characters" };
  if (!input.designation.trim()) return { error: "Designation is required" };

  const role = await prisma.role.findUnique({ where: { id: input.roleId } });
  if (!role) return { error: "Invalid role" };
  const roleError = assertAssignableRole(actor, role);
  if (roleError) return { error: roleError };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "A user with this email already exists" };

  const { user } = await auth.api.signUpEmail({
    body: { name, email, password: input.password },
  });

  // signUpEmail signs the invitee in; drop the auto-created session.
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await prismaWithAudit(actor.id).user.update({
    where: { id: user.id },
    data: { roleId: role.id, designation: input.designation.trim() },
  });

  revalidatePath("/users");
  return { ok: true as const, id: user.id };
}

export type UpdateUserInput = {
  name: string;
  designation: string;
  roleId: string;
};

export async function updateUserAction(id: string, input: UpdateUserInput) {
  const actor = await mustUser();
  requirePermission(actor, "manage:users");

  const name = input.name.trim();
  if (!name) return { error: "Name is required" };

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { error: "User not found" };
  if (target.isSuperAdmin && !actor.isSuperAdmin) {
    return { error: "Only super admins can edit a super admin" };
  }

  const role = await prisma.role.findUnique({ where: { id: input.roleId } });
  if (!role) return { error: "Invalid role" };
  const roleError = assertAssignableRole(actor, role);
  if (roleError) return { error: roleError };

  await prismaWithAudit(actor.id).user.update({
    where: { id },
    data: { name, roleId: role.id, designation: input.designation.trim() || null },
  });

  revalidatePath("/users");
  return { ok: true as const };
}

export type AllocateLeaveInput = {
  userId: string;
  fiscalYear: string;
  leaveType: LeaveType;
  // Annual lump for REGULAR/COMPENSATORY/HALF_DAY.
  allocated?: number;
  // Monthly accrual (PAID only).
  perMonth?: number;
};

export async function setLeaveBalanceAction(input: AllocateLeaveInput) {
  const actor = await mustUser();
  requirePermission(actor, "manage:leaves");

  if (input.leaveType === "PAID") {
    if (!Number.isFinite(input.perMonth) || (input.perMonth ?? -1) < 0) {
      return { error: "Paid days per month must be a non-negative number" };
    }
  } else {
    if (!Number.isFinite(input.allocated) || (input.allocated ?? -1) < 0) {
      return { error: "Allocated days must be a non-negative number" };
    }
  }

  const perMonth = input.leaveType === "PAID" ? (input.perMonth ?? 0) : 0;
  const allocated = input.leaveType === "PAID" ? 0 : (input.allocated ?? 0);

  await prismaWithAudit(actor.id).leaveBalance.upsert({
    where: {
      userId_fiscalYear_leaveType: {
        userId: input.userId,
        fiscalYear: input.fiscalYear,
        leaveType: input.leaveType,
      },
    },
    create: {
      userId: input.userId,
      fiscalYear: input.fiscalYear,
      leaveType: input.leaveType,
      allocated,
      perMonth,
    },
    update: { allocated, perMonth },
  });

  revalidatePath("/users");
  return { ok: true as const };
}