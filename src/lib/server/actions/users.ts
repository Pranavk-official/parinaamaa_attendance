"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/auth";
import { prisma, prismaWithAudit } from "@/lib/db/prisma";
import { mustUser, requirePermission } from "@/lib/auth/auth-user";
import { isLeaveExempt } from "@/lib/domain/leave-policy";
import { fiscalYear } from "@/lib/domain/fiscal";
import { getFiscalStart } from "@/lib/domain/settings";
import type { SalaryBasis } from "@/generated/prisma/client";

// REGULAR leave is unpaid and uncapped and half days are uncapped, so PAID and
// COMPENSATORY are the only balances an admin ever sets.
export type LeaveAllocation = {
  paidPerMonth: number;
  compensatoryAllocated: number;
};

// Salary is stored as entered; the basis says whether it is a monthly gross or
// an annual CTC. Payroll derives the monthly figure from the pair.
export type SalaryInput = {
  salary: number | null;
  salaryBasis: SalaryBasis;
};

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  designation: string;
  roleId: string;
  leave?: LeaveAllocation;
  pay?: SalaryInput;
};

function salaryError(pay: SalaryInput): string | null {
  if (pay.salary === null) return null;
  return Number.isFinite(pay.salary) && pay.salary >= 0
    ? null
    : "Salary must be a non-negative number";
}

// Paid leave is allocated in whole days; a half day is drawn from that balance.
function allocationError(leave: LeaveAllocation): string | null {
  if (!Number.isInteger(leave.paidPerMonth) || leave.paidPerMonth < 0) {
    return "Paid days per month must be a whole number of days";
  }
  if (!Number.isFinite(leave.compensatoryAllocated) || leave.compensatoryAllocated < 0) {
    return "Compensatory days must be a non-negative number";
  }
  return null;
}

async function setAllocations(actorId: string, userId: string, leave: LeaveAllocation) {
  const fy = fiscalYear(new Date(), await getFiscalStart());
  const db = prismaWithAudit(actorId);
  for (const [leaveType, allocated, perMonth] of [
    ["PAID", 0, leave.paidPerMonth],
    ["COMPENSATORY", leave.compensatoryAllocated, 0],
  ] as const) {
    await db.leaveBalance.upsert({
      where: { userId_fiscalYear_leaveType: { userId, fiscalYear: fy, leaveType } },
      create: { userId, fiscalYear: fy, leaveType, allocated, perMonth },
      update: { allocated, perMonth },
    });
  }
}

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
  const allocationProblem = input.leave && allocationError(input.leave);
  if (allocationProblem) return { error: allocationProblem };
  const payProblem = input.pay && salaryError(input.pay);
  if (payProblem) return { error: payProblem };

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
    data: {
      roleId: role.id,
      designation: input.designation.trim(),
      ...(input.pay ? { salary: input.pay.salary, salaryBasis: input.pay.salaryBasis } : {}),
    },
  });
  if (input.pay) {
    await prismaWithAudit(actor.id).salaryHistory.create({
      data: {
        userId: user.id,
        salary: input.pay.salary,
        basis: input.pay.salaryBasis,
      },
    });
  }
  if (input.leave && !isLeaveExempt({ isSuperAdmin: false, role })) {
    await setAllocations(actor.id, user.id, input.leave);
  }

  revalidatePath("/users");
  return { ok: true as const, id: user.id };
}

export type UpdateUserInput = {
  name: string;
  designation: string;
  roleId: string;
  leave?: LeaveAllocation;
  pay?: SalaryInput;
};

export async function updateUserAction(id: string, input: UpdateUserInput) {
  const actor = await mustUser();
  requirePermission(actor, "manage:users");

  const name = input.name.trim();
  if (!name) return { error: "Name is required" };
  const allocationProblem = input.leave && allocationError(input.leave);
  if (allocationProblem) return { error: allocationProblem };
  const payProblem = input.pay && salaryError(input.pay);
  if (payProblem) return { error: payProblem };

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
    data: {
      name,
      roleId: role.id,
      designation: input.designation.trim() || null,
      ...(input.pay ? { salary: input.pay.salary, salaryBasis: input.pay.salaryBasis } : {}),
    },
  });
  if (input.pay) {
    const changed =
      target.salary !== input.pay.salary || target.salaryBasis !== input.pay.salaryBasis;
    if (changed) {
      await prismaWithAudit(actor.id).salaryHistory.create({
        data: {
          userId: id,
          salary: input.pay.salary,
          basis: input.pay.salaryBasis,
        },
      });
    }
  }
  if (input.leave && !isLeaveExempt({ isSuperAdmin: target.isSuperAdmin, role })) {
    await setAllocations(actor.id, id, input.leave);
  }

  revalidatePath("/users");
  return { ok: true as const };
}

export async function deleteUserAction(id: string) {
  const actor = await mustUser();
  requirePermission(actor, "manage:users");

  if (id === actor.id) return { error: "You cannot delete your own account" };

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { error: "User not found" };
  if (target.isSuperAdmin && !actor.isSuperAdmin) {
    return { error: "Only super admins can delete a super admin" };
  }

  await prismaWithAudit(actor.id).user.delete({ where: { id } });
  revalidatePath("/users");
  return { ok: true as const };
}

// Re-hashes and replaces the credential password. Fixes accounts whose stored
// hash does not match the intended password (e.g. mangled by the old Excel
// import that trimmed/coerced the password cell).
export async function resetUserPasswordAction(id: string, password: string) {
  const actor = await mustUser();
  requirePermission(actor, "manage:users");

  if (password.length < 8) return { error: "Password must be at least 8 characters" };
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { error: "User not found" };
  if (target.isSuperAdmin && !actor.isSuperAdmin) {
    return { error: "Only super admins can reset a super admin" };
  }

  const count = await setCredentialPassword(actor.id, id, password);
  if (count === 0) return { error: "No password account found for this user" };
  return { ok: true as const };
}

// Shared credential-password writer. Returns the number of credential accounts
// updated; always signs the user out everywhere.
async function setCredentialPassword(actorId: string, userId: string, password: string) {
  const { hashPassword } = await import("better-auth/crypto");
  const hashed = await hashPassword(password);
  const updated = await prismaWithAudit(actorId).account.updateMany({
    where: { userId, providerId: "credential" },
    data: { password: hashed },
  });
  await prisma.session.deleteMany({ where: { userId } });
  return updated.count;
}

// Bulk import entry point: creates the account, or updates every column from
// the sheet when the email already exists — including the password, which
// signs that user out everywhere.
export async function upsertUserAction(input: CreateUserInput) {
  const actor = await mustUser();
  requirePermission(actor, "manage:users");

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { error: "Name is required" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Invalid email" };
  if (input.password.length < 8) return { error: "Password must be at least 8 characters" };
  if (!input.designation.trim()) return { error: "Designation is required" };
  const allocationProblem = input.leave && allocationError(input.leave);
  if (allocationProblem) return { error: allocationProblem };
  const payProblem = input.pay && salaryError(input.pay);
  if (payProblem) return { error: payProblem };

  const role = await prisma.role.findUnique({ where: { id: input.roleId } });
  if (!role) return { error: "Invalid role" };
  const roleError = assertAssignableRole(actor, role);
  if (roleError) return { error: roleError };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const res = await createUserAction(input);
    if ("error" in res) return res;
    return { ok: true as const, id: res.id, created: true as const };
  }
  if (existing.isSuperAdmin && !actor.isSuperAdmin) {
    return { error: "Only super admins can edit a super admin" };
  }

  const db = prismaWithAudit(actor.id);
  await db.user.update({
    where: { id: existing.id },
    data: {
      name,
      roleId: role.id,
      designation: input.designation.trim(),
      ...(input.pay ? { salary: input.pay.salary, salaryBasis: input.pay.salaryBasis } : {}),
    },
  });
  if (input.pay) {
    const oldSalary = existing.salary === null ? null : Number(existing.salary);
    if (oldSalary !== input.pay.salary || existing.salaryBasis !== input.pay.salaryBasis) {
      await db.salaryHistory.create({
        data: { userId: existing.id, salary: input.pay.salary, basis: input.pay.salaryBasis },
      });
    }
  }
  if (input.leave && !isLeaveExempt({ isSuperAdmin: existing.isSuperAdmin, role })) {
    await setAllocations(actor.id, existing.id, input.leave);
  }
  await setCredentialPassword(actor.id, existing.id, input.password);

  revalidatePath("/users");
  return { ok: true as const, id: existing.id, created: false as const };
}
