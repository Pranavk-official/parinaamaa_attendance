"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISSED_KEY = "install-prompt-dismissed";

/** Chrome fires this so the page can defer the install banner to its own UI. */
type InstallEvent = Event & { prompt: () => Promise<void> };

const subscribeNothing = () => () => {};

export function InstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(DISMISSED_KEY) === "1"
  );
  // Nothing here can render until the browser is known, and the server knows
  // none of it, so the first client render has to match the server's null.
  const hydrated = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false
  );

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => setEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!hydrated || dismissed) return null;

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS has no display-mode support in older versions.
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return null;

  // Safari never fires beforeinstallprompt, so iOS gets the manual steps.
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!event && !isIos) return null;

  const hide = () => {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, "1");
  };

  return (
    <div
      // Clears the mobile tab bar, which is 3.5rem plus the safe area.
      className="fixed inset-x-3 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.75rem)] z-40 mx-auto flex max-w-md items-center gap-3 border bg-card p-3 text-card-foreground shadow-lg md:inset-x-auto md:right-4 md:bottom-4"
      role="dialog"
      aria-label="Install Attendance"
    >
      <Download className="size-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1 text-xs">
        <p className="font-medium">Install Attendance</p>
        <p className="text-muted-foreground">
          {isIos ? (
            <>
              Tap <Share className="inline size-3 align-[-2px]" /> then
              &ldquo;Add to Home Screen&rdquo;.
            </>
          ) : (
            "Punch in and out straight from your home screen."
          )}
        </p>
      </div>
      {event && (
        <Button
          size="sm"
          onClick={() => {
            event.prompt();
            hide();
          }}
        >
          Install
        </Button>
      )}
      <Button size="icon-sm" variant="ghost" aria-label="Dismiss" onClick={hide}>
        <X />
      </Button>
    </div>
  );
}
