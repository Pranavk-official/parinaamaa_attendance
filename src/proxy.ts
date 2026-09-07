import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const PROTECTED = [{ matcher: ["/attendance/wfo-punch"], target: "/login" }];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rule = PROTECTED.find((r) => r.matcher.includes(pathname));
  if (!rule) return NextResponse.next();

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const loginUrl = new URL(rule.target, request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  // Run on every request; NextRequest is cheap and the matcher check is local.
  matcher: ["/attendance/wfo-punch"],
};