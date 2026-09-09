import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import type { User } from "@/generated/prisma/client";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
  designation: string | null;
  role: { name: string; permissions: string[] } | null;
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) return null;
  const user = session.user as User & { designation?: string | null };
  const prismaUser = await (await import("@/lib/db/prisma")).prisma.user.findUnique({
    where: { id: user.id },
    include: { role: true },
  });
  if (!prismaUser) return null;
  return {
    id: prismaUser.id,
    name: prismaUser.name,
    email: prismaUser.email,
    isSuperAdmin: prismaUser.isSuperAdmin,
    designation: prismaUser.designation,
    role: prismaUser.role
      ? { name: prismaUser.role.name, permissions: prismaUser.role.permissions }
      : null,
  };
});

export async function mustUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthenticated");
  return user;
}

export function hasPermission(
  user: CurrentUser | null | undefined,
  requiredPermission: string
): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  if (!user.role) return false;
  return user.role.permissions.includes("*") || user.role.permissions.includes(requiredPermission);
}

export function requirePermission(user: CurrentUser, permission: string) {
  if (!hasPermission(user, permission)) throw new Error("Forbidden");
}