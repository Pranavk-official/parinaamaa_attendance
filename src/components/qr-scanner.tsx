"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { ScanLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QrScanner() {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stop(), [stop]);

  const onDecode = useCallback(
    (content: string) => {
      stop();
      setActive(false);
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

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setActive(true);
      const video = videoRef.current!;
      const canvas = canvasRef.current!;
      video.srcObject = stream;
      await video.play();

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
      setActive(false);
    }
  }, [onDecode]);

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" onClick={start} className="w-full">
        <ScanLine />
        Scan office QR to punch
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div hidden={!active} className="relative">
        <video
          ref={videoRef}
          className="aspect-video w-full rounded-md border object-cover"
          muted
          playsInline
        />
        <canvas ref={canvasRef} className="hidden" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2"
          aria-label="Stop scanning"
          onClick={() => {
            stop();
            setActive(false);
          }}
        >
          <X />
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Point the office WFO badge at the camera.
        </p>
      </div>
    </div>
  );
}