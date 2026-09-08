import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer, jwt } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  appName: "Attendance",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    // Users sign in via password; email stays unverified by default.
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days (admin & super admin stay signed in)
    // Sliding window: two hours of activity pushes the expiry out again, up to
    // the 7- or 30-day ceiling above.
    updateAge: 60 * 60 * 2,
  },
  user: {
    additionalFields: {
      designation: { type: "string", required: false },
      roleId: { type: "string", required: false },
      isSuperAdmin: { type: "boolean", required: false },
    },
  },
  databaseHooks: {
    session: {
      create: {
        // Employees keep a 7-day session window; admins get the 30-day default.
        before: async (session) => {
          const u = await prisma.user.findUnique({
            where: { id: session.userId as string },
            select: {
              isSuperAdmin: true,
              role: { select: { permissions: true } },
            },
          });
          const isExempt = !!u?.isSuperAdmin || (u?.role?.permissions.length ?? 0) > 0;
          if (!isExempt) {
            return { data: { expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } };
          }
        },
      },
    },
  },
  plugins: [bearer(), jwt()],
});