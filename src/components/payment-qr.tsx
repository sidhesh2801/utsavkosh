"use client";

import { useEffect, useMemo, useState } from "react";
import { useSociety } from "@/lib/store";
import { money } from "@/lib/format";
import { Button, EmptyState, LinkButton } from "./ui";
import type { PaymentQr } from "@/lib/types";

/**
 * Shows the society's payment QR full-screen so a resident can scan it off the
 * volunteer's phone.
 *
 * These are the QR images the society already has from its bank or PhonePe —
 * held as pictures rather than generated, which is both what committees
 * actually have and one fewer place to mistype an account.
 */
export function ShowQrSheet({
  amount,
  activityId,
  onClose,
}: {
  amount?: number;
  activityId?: string | null;
  onClose: () => void;
}) {
  const { data, isAdmin } = useSociety();

  /** QRs tied to this activity first, then the general ones. */
  const available = useMemo(() => {
    const live = (data.paymentQrs ?? []).filter((q) => !q.archived);
    const forActivity = live.filter((q) => q.activityId && q.activityId === activityId);
    const general = live.filter((q) => !q.activityId);
    return [...forActivity, ...general];
  }, [data.paymentQrs, activityId]);

  const [index, setIndex] = useState(0);
  const qr: PaymentQr | undefined = available[index];

  // Keep the screen bright and awake while someone is scanning it.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        lock = await navigator.wakeLock?.request("screen");
      } catch {
        /* unsupported or denied — the screen may dim, which is survivable */
      }
    };
    void request();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      void lock?.release();
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-white">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{data.society.name}</p>
          <p className="text-xs text-ink-soft">Scan to pay</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          // Distinct from the underlying form sheet's own Close button, which
          // is stacked beneath this one.
          aria-label="Close QR code"
          className="rounded-lg p-2 text-ink-soft transition-colors hover:bg-surface-sunken"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-5 py-4">
        {qr?.src ? (
          <>
            {amount ? (
              <p className="text-center">
                <span className="block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                  Amount to pay
                </span>
                <span className="block text-3xl font-semibold tracking-[-0.01em] text-ink">
                  {money(amount)}
                </span>
              </p>
            ) : null}

            {/* Plain white surround and no rounding over the code itself —
                anything overlapping the pattern can stop a scanner reading it. */}
            <div className="rounded-xl border border-line bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr.src}
                alt={`Payment QR code — ${qr.label}`}
                className="h-auto w-[min(78vw,20rem)]"
              />
            </div>

            <p className="text-center text-sm font-medium text-ink">{qr.label}</p>

            {amount ? (
              <p className="max-w-xs text-center text-xs leading-relaxed text-ink-soft">
                This QR does not carry the amount — ask them to enter{" "}
                <span className="font-semibold text-ink">{money(amount)}</span> themselves, and
                check their confirmation screen before you record it.
              </p>
            ) : null}

            {available.length > 1 ? (
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {available.map((option, i) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setIndex(i)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      i === index
                        ? "border-brand bg-brand text-white"
                        : "border-line-strong text-ink-soft hover:border-brand hover:text-brand"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <EmptyState
            title="No payment QR uploaded yet"
            description={
              isAdmin
                ? "Upload the QR image your bank or PhonePe gave the society, and volunteers can show it at the door."
                : "Ask a committee admin to upload the society's payment QR."
            }
            action={isAdmin ? <LinkButton href="/admin">Upload a QR</LinkButton> : undefined}
          />
        )}
      </div>

      <div className="border-t border-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button variant="secondary" className="w-full" onClick={onClose}>
          Done — they&apos;ve paid
        </Button>
      </div>
    </div>
  );
}
