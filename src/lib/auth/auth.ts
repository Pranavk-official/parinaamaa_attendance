import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer, jwt } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { prisma } from "@/lib/db/prisma";

const EMPLOYEE_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const employeeExpiry = () => new Date(Date.now() + EMPLOYEE_SESSION_MS);

const sessionSubject = (userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: { isBlocked: true, isSuperAdmin: true, role: { select: { permissions: true } } },
  });

// Employees keep a 7-day session window; admins get the 30-day default.
const isExempt = (u: Awaited<ReturnType<typeof sessionSubject>>) =>
  !!u?.isSuperAdmin || (u?.role?.permissions.length ?? 0) > 0;

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
          const u = await sessionSubject(session.userId as string);
          // Blocked users cannot sign in at all (password or passkey).
          if (u?.isBlocked) {
            throw new APIError("FORBIDDEN", { message: "Account blocked. Contact your admin." });
          }
          if (!isExempt(u)) return { data: { expiresAt: employeeExpiry() } };
        },
      },
      update: {
        // The sliding refresh above always extends to the global 30 days, so
        // without this an employee's 7-day session became 30 on first use.
        before: async (session, ctx) => {
          const userId = ctx?.context.session?.user.id;
          if (!session.expiresAt || !userId) return;
          if (!isExempt(await sessionSubject(userId))) {
            return { data: { ...session, expiresAt: employeeExpiry() } };
          }
        },
      },
    },
  },
  plugins: [
    passkey({
      rpName: "Attendance",
      // No authenticatorAttachment: forcing "platform" blocked security keys and
      // signing in on a desktop with a phone (QR / hybrid). Sign-in sends no
      // allowCredentials, so the credential must be discoverable.
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
    }),
    bearer(),
    jwt(),
  ],
});