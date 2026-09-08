"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function QrScanner() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Releasing the camera matters more than most cleanups: the indicator light
  // stays on until every track is stopped.
  useEffect(() => () => stop(), [stop]);

  const onDecode = useCallback(
    (content: string) => {
      stop();
      setOpen(false);
      try {
        const url = new URL(content, window.location.origin);
        if (url.origin !== window.location.origin) {
          setError("This QR isn't for our app.");
          return;
        }
        router.push(url.pathname + url.search + url.hash);
      } catch {
        setError("Unrecognized QR code.");
      }
    },
    [router, stop],
  );

  const start = useCallback(
    async (video: HTMLVideoElement) => {
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        streamRef.current = stream;
        video.srcObject = stream;
        await video.play();

        // Offscreen: the frames are only ever read, never shown.
        const canvas = document.createElement("canvas");
        const tick = () => {
          if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(image.data, image.width, image.height, {
                inversionAttempts: "dontInvert",
              });
              if (code?.data) {
                onDecode(code.data);
                return;
              }
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        setError("Camera unavailable. Allow camera access to scan a QR.");
      }
    },
    [onDecode],
  );

  // The <video> only exists once the dialog has mounted, so the camera starts
  // from the element's own ref callback rather than from the click.
  const attachVideo = useCallback(
    (video: HTMLVideoElement | null) => {
      if (video) void start(video);
    },
    [start],
  );

  return (
    <div className="flex flex-col gap-2">
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) stop();
        }}
      >
        <DialogTrigger
          render={
            <Button type="button" variant="outline" className="w-full">
              <ScanLine />
              Scan office QR to punch
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan the office QR</DialogTitle>
            <DialogDescription>
              Point the camera at the badge by the entrance. It punches you in as soon
              as it reads.
            </DialogDescription>
          </DialogHeader>
          <video
            ref={attachVideo}
            className="aspect-video w-full border object-cover"
            muted
            playsInline
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </DialogContent>
      </Dialog>
      {!open && error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-center text-xs text-muted-foreground">
        At the office? Scan the entrance QR to punch in as WFO.
      </p>
    </div>
  );
}
