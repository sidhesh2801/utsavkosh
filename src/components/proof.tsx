"use client";

import { useRef, useState } from "react";
import { useSociety } from "@/lib/store";
import { Button, useConfirm, useToast } from "./ui";
import type { Donation } from "@/lib/types";

/**
 * Capture of the audit proof behind an entry — a photograph of the paper
 * receipt stub for cash, or the payer's UPI confirmation screenshot.
 *
 * `capture="environment"` opens the rear camera straight away on a phone, which
 * is what a volunteer wants at a doorstep. The gallery option stays available
 * for a screenshot the resident has forwarded.
 */
export function ProofCapture({
  donation,
  compact = false,
}: {
  donation: Donation;
  compact?: boolean;
}) {
  const { attachProof, removeProof, canCollect } = useSociety();
  const toast = useToast();
  const confirm = useConfirm();
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handle(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    const result = await attachProof(donation.id, file);
    setBusy(false);
    if (camera.current) camera.current.value = "";
    if (gallery.current) gallery.current.value = "";
    toast(result.ok ? "Proof attached." : result.error, result.ok ? "success" : "error");
  }

  if (donation.proofSrc) {
    return (
      <div className={compact ? "" : "mt-2"}>
        <div className="relative inline-block">
          {/* Local data URL — next/image would need remote-pattern config for no gain. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={donation.proofSrc}
            alt={`Proof of payment for receipt ${donation.receiptNo}`}
            className={`rounded-lg border border-line object-cover ${
              compact ? "h-16 w-16" : "h-32 w-32"
            }`}
          />
          {canCollect ? (
            <button
              type="button"
              aria-label="Remove proof"
              onClick={async () => {
                if (!confirm("Remove this proof photograph?")) return;
                const r = await removeProof(donation.id);
                if (!r.ok) toast(r.error, "error");
              }}
              className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-white transition-colors hover:bg-debit"
            >
              <svg width="10" height="10" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (!canCollect) return null;

  return (
    <div className={compact ? "" : "mt-2"}>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void handle(e.target.files)}
      />
      <input
        ref={gallery}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handle(e.target.files)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => camera.current?.click()}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 8h3l1.5-2h7L17 8h3v11H4z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.7" />
          </svg>
          {busy ? "Saving…" : "Photograph proof"}
        </Button>
        <button
          type="button"
          onClick={() => gallery.current?.click()}
          className="text-[0.6875rem] font-medium text-ink-soft underline decoration-line-strong underline-offset-2 hover:text-ink"
        >
          Choose a screenshot
        </button>
      </div>
      {!compact ? (
        <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-ink-faint">
          The paper receipt stub for cash, or their UPI &ldquo;payment successful&rdquo; screen.
        </p>
      ) : null}
    </div>
  );
}
