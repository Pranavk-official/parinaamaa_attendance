"use client";

import { createAuthClient } from "better-auth/react";
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  // baseURL is inferred from window.location, no need to set it.
  plugins: [passkeyClient()],
});
// WebAuthn error codes from @simplewebauthn/browser, plus the plugin's own.
const PASSKEY_MESSAGES: Record<string, string> = {
  AUTH_CANCELLED: "Passkey request was cancelled or timed out.",
  ERROR_CEREMONY_ABORTED: "Passkey request was cancelled or timed out.",
  ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED: "This device already has a passkey for your account.",
  ERROR_INVALID_DOMAIN: "Passkeys only work on the app's own address. Open it from its usual link.",
  ERROR_INVALID_RP_ID: "Passkeys only work on the app's own address. Open it from its usual link.",
  PASSKEY_NOT_FOUND: "That passkey is no longer registered. Sign in with your password.",
};

export function passkeyError(err: { code?: string; message?: string }, fallback: string) {
  if (err.code && PASSKEY_MESSAGES[err.code]) return PASSKEY_MESSAGES[err.code];
  // Any other browser-side WebAuthn failure is, to the user, a dismissed prompt.
  if (err.code?.startsWith("ERROR_")) return PASSKEY_MESSAGES.AUTH_CANCELLED;
  return err.message || fallback;
}
