import * as React from "react";

function subscribe() {
  return () => {};
}

/**
 * WebAuthn availability cannot be known until the browser runs. Hydrate with
 * the server's answer, then use the browser's real answer.
 */
export function usePasskeySupported() {
  return React.useSyncExternalStore(
    subscribe,
    () => typeof window.PublicKeyCredential !== "undefined",
    () => false
  );
}
