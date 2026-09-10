import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer, jwt } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { prisma } from "@/lib/db/prisma";

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
        before: async (session) => {
          const u = await prisma.user.findUnique({
            where: { id: session.userId as string },
            select: {
              isBlocked: true,
              isSuperAdmin: true,
              role: { select: { permissions: true } },
            },
          });
          // Blocked users cannot sign in at all (password or passkey).
          if (u?.isBlocked) {
            throw new APIError("FORBIDDEN", { message: "Account blocked. Contact your admin." });
          }
          // Employees keep a 7-day session window; admins get the 30-day default.
          const isExempt = !!u?.isSuperAdmin || (u?.role?.permissions.length ?? 0) > 0;
          if (!isExempt) {
            return { data: { expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } };
          }
        },
      },
    },
  },
  plugins: [
    passkey({
      rpName: "Attendance",
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "preferred",
        userVerification: "required",
      },
    }),
    bearer(),
    jwt(),
  ],
});