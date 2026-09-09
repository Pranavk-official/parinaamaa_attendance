"use client";

import { createAuthClient } from "better-auth/react";
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  // baseURL is inferred from window.location, no need to set it.
  plugins: [passkeyClient()],
});