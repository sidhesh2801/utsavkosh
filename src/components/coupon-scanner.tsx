"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, useToast } from "./ui";

/**
 * Scanning coupons without leaving the page.
 *
 * The phone's own camera app works — the QR holds a URL — but at a counter it
 * means switching Camera → browser → Camera for every family, a hundred times
 * over. This keeps the volunteer in one place: point, tap a number, and the
 * camera is already back for the next person.
 *
 * Android decodes QR natively in the browser; Safari does not, so a small
 * decoder is loaded only on the phones that need it.
 */

interface Coupon {
  code: string;
  name: string;
  flat: string;
  members: number;
  served: number;
  remaining: number;
}

/** Chrome's native decoder, absent on Safari. */
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

/** Accepts a full coupon URL or a bare code — people paste both. */
function extractCode(raw: string): string | null {
  const text = raw.trim();
  const fromUrl = text.match(/\/coupon\/([A-Za-z0-9]{4,12})/);
  if (fromUrl) return fromUrl[1].toUpperCase();
  const bare = text.match(/^[A-Za-z0-9]{6}$/);
  return bare ? text.toUpperCase() : null;
}

export function ScanButton({ onServed }: { onServed: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="lg" className="w-full" onClick={() => setOpen(true)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        Scan a coupon
      </Button>
      {open ? <Scanner onClose={() => setOpen(false)} onServed={onServed} /> : null}
    </>
  );
}

function Scanner({ onClose, onServed }: { onClose: () => void; onServed: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanning = useRef(true);
  const toast = useToast();

  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);

  const stopCamera = useCallback(() => {
    scanning.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const lookUp = useCallback(
    async (code: string) => {
      stopCamera();
      const res = await fetch(`/api/coupons/${code}`);
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "No coupon with that code.");
        return;
      }
      setError(null);
      setCoupon(payload.coupon);
    },
    [stopCamera],
  );

  /** Opens the camera and reads frames until a QR appears. */
  const startCamera = useCallback(async () => {
    setCoupon(null);
    setError(null);
    scanning.current = true;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
    } catch {
      setError(
        "Couldn't open the camera. Allow camera access for this site, or type the code below.",
      );
      return;
    }
    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    await video.play().catch(() => {});

    const native = window.BarcodeDetector
      ? new window.BarcodeDetector({ formats: ["qr_code"] })
      : null;
    // Loaded only where it's needed; Android never downloads it.
    const jsQR = native ? null : (await import("jsqr")).default;

    const tick = async () => {
      if (!scanning.current || !videoRef.current || !canvasRef.current) return;
      const v = videoRef.current;
      if (v.readyState === v.HAVE_ENOUGH_DATA) {
        const canvas = canvasRef.current;
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          let raw: string | null = null;
          try {
            if (native) {
              const found = await native.detect(canvas);
              raw = found[0]?.rawValue ?? null;
            } else if (jsQR) {
              const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
              raw = jsQR(image.data, image.width, image.height)?.data ?? null;
            }
          } catch {
            /* a frame that won't decode is normal; try the next one */
          }
          const code = raw ? extractCode(raw) : null;
          if (code) {
            void lookUp(code);
            return;
          }
        }
      }
      requestAnimationFrame(() => void tick());
    };
    void tick();
  }, [lookUp]);

  useEffect(() => {
    const t = setTimeout(() => void startCamera(), 0);
    return () => {
      clearTimeout(t);
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  async function serve(count: number) {
    if (!coupon) return;
    setBusy(true);
    const res = await fetch(`/api/coupons/${coupon.code}/serve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count }),
    });
    const payload = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast(payload.error ?? "Could not record it.", "error");
      setCoupon({ ...coupon, ...payload });
      return;
    }
    toast(`Served ${count} · ${coupon.name}`);
    onServed();
    // Straight back to the camera: there is a queue behind them.
    void startCamera();
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-ink">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm font-medium text-white/90">
          {coupon ? "Coupon" : "Point at the QR"}
        </p>
        <button
          type="button"
          onClick={() => {
            stopCamera();
            onClose();
          }}
          aria-label="Close scanner"
          className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4">
        {coupon ? (
          <Result coupon={coupon} busy={busy} onServe={serve} onAgain={() => void startCamera()} />
        ) : (
          <>
            <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-black">
              <video ref={videoRef} playsInline muted className="h-auto w-full" />
              {/* A frame to aim with — people hold the phone much too far back. */}
              <div className="pointer-events-none absolute inset-[15%] rounded-xl border-2 border-white/70" />
            </div>
            <canvas ref={canvasRef} className="hidden" />
            {error ? (
              <p className="mt-4 max-w-sm rounded-lg bg-warn-soft px-3 py-2.5 text-center text-[0.8125rem] text-warn">
                {error}
              </p>
            ) : (
              <p className="mt-4 text-center text-[0.8125rem] text-white/60">
                Hold the code inside the square
              </p>
            )}

            {/* For a cracked screen, or a QR that simply will not read. */}
            <form
              className="mt-5 flex w-full max-w-sm gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const code = extractCode(manual);
                if (!code) {
                  setError("That doesn't look like a coupon code.");
                  return;
                }
                void lookUp(code);
              }}
            >
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value.toUpperCase())}
                placeholder="Or type the code"
                className="tnum w-full rounded-[10px] border border-white/20 bg-white/10 px-3 py-2.5 text-center text-base uppercase tracking-[0.15em] text-white placeholder:normal-case placeholder:tracking-normal placeholder:text-white/40"
                autoCapitalize="characters"
                autoCorrect="off"
              />
              <Button type="submit" variant="secondary">
                Find
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Result({
  coupon,
  busy,
  onServe,
  onAgain,
}: {
  coupon: Coupon;
  busy: boolean;
  onServe: (n: number) => void;
  onAgain: () => void;
}) {
  const done = coupon.remaining <= 0;
  return (
    <div className="w-full max-w-sm text-center">
      <p className="tnum text-xs tracking-[0.15em] text-white/50">{coupon.code}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{coupon.name}</p>
      {coupon.flat ? <p className="tnum text-base text-white/70">{coupon.flat}</p> : null}

      <div
        className={`mt-5 rounded-2xl px-5 py-6 ${done ? "bg-white/10" : "bg-white"}`}
      >
        {done ? (
          <p className="text-xl font-semibold text-white">Fully served</p>
        ) : (
          <>
            <p className="tnum text-5xl font-semibold leading-none text-brand-ink">
              {coupon.remaining}
            </p>
            <p className="mt-1 text-sm text-ink-soft">still to eat, of {coupon.members}</p>
          </>
        )}
      </div>

      {!done ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {Array.from({ length: Math.min(coupon.remaining, 6) }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              disabled={busy}
              onClick={() => onServe(n)}
              className="tnum rounded-xl bg-brand py-5 text-2xl font-semibold text-white hover:bg-brand-deep disabled:opacity-50"
            >
              {n}
            </button>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onAgain}
        className="mt-4 w-full rounded-xl border border-white/25 py-3 text-sm font-medium text-white"
      >
        Scan the next one
      </button>
    </div>
  );
}
