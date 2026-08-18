"use client";

import { useState } from "react";
import { useLookups, useSociety } from "@/lib/store";
import { receiptLines, receiptMessage, toWhatsAppNumber } from "@/lib/receipt";
import { money } from "@/lib/format";
import { Badge, Button, Field, Sheet, useToast } from "./ui";
import type { Donation } from "@/lib/types";

const WhatsAppIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.06c-.24.68-1.4 1.3-1.93 1.35-.53.05-1.02.15-3.5-.85-2.97-1.2-4.83-4.28-4.98-4.48-.14-.2-1.17-1.62-1.17-3.1 0-1.47.77-2.19 1.05-2.49.27-.3.6-.37.8-.37.19 0 .39 0 .56.01.18.01.42-.07.66.5.24.58.83 2.02.9 2.17.07.15.12.32.02.51-.1.2-.15.32-.3.5-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.3.76 1.25 1.63 2.03 1.12 1 2.06 1.31 2.36 1.46.29.15.46.12.63-.07.17-.2.73-.85.92-1.14.2-.3.39-.25.66-.15.27.1 1.7.8 1.99.95.29.15.48.22.55.34.07.13.07.73-.17 1.41Z" />
  </svg>
);

/**
 * Shows the receipt for a contribution and sends it to the donor's WhatsApp.
 *
 * Delivery is a `wa.me` deep link to that specific number: WhatsApp opens on
 * their chat with the receipt already typed, and the volunteer taps send. This
 * costs nothing and needs no approvals. Sending automatically instead would
 * require Meta Cloud API business verification and a dedicated number — see the
 * README for what that involves.
 */
export function ReceiptSheet({
  donation,
  onClose,
}: {
  donation: Donation;
  onClose: () => void;
}) {
  const { data, markReceiptSent } = useSociety();
  const { activityById, memberById } = useLookups();
  const toast = useToast();

  const activity = donation.activityId ? activityById.get(donation.activityId) ?? null : null;
  const receivedBy = memberById.get(donation.recordedBy)?.name ?? "Committee";
  const lines = receiptLines(donation, data.society, activity, receivedBy);

  const [mobile, setMobile] = useState(donation.donorMobile ?? "");
  const text = receiptMessage(donation, data.society, activity, receivedBy);

  function send() {
    const number = toWhatsAppNumber(mobile);
    if (!number) {
      toast("That doesn't look like a valid mobile number.", "error");
      return;
    }
    const url = `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      void navigator.clipboard
        .writeText(text)
        .then(() => toast("WhatsApp didn't open — the receipt is on your clipboard."))
        .catch(() => toast("Could not open WhatsApp.", "error"));
      return;
    }
    void markReceiptSent(donation.id);
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Receipt ${donation.receiptNo}`}
      description="Send it to the contributor's WhatsApp, or print it."
      footer={
        <>
          <Button variant="secondary" onClick={() => window.print()}>
            Print
          </Button>
          <Button onClick={send} disabled={!mobile.trim()}>
            <WhatsAppIcon />
            Send on WhatsApp
          </Button>
        </>
      }
    >
      {/* The receipt itself */}
      <div className="rounded-xl border border-line-strong bg-surface p-4">
        <div className="border-b border-dashed border-line-strong pb-3 text-center">
          <p className="text-[0.9375rem] font-semibold text-ink">{data.society.name}</p>
          {data.society.address ? (
            <p className="mt-0.5 text-[0.6875rem] leading-snug text-ink-soft">
              {data.society.address}
            </p>
          ) : null}
          <p className="mt-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-faint">
            Receipt
          </p>
        </div>

        <dl className="mt-3 space-y-1.5">
          {lines.map((line) => (
            <div key={line.label} className="flex gap-3 text-[0.8125rem]">
              <dt className="w-28 shrink-0 text-ink-faint">{line.label}</dt>
              <dd
                className={`min-w-0 flex-1 ${
                  line.label === "Amount"
                    ? "tnum text-base font-semibold text-ink"
                    : line.label === "In words"
                      ? "italic text-ink-soft"
                      : "text-ink"
                }`}
              >
                {line.value}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 border-t border-dashed border-line-strong pt-3 text-center text-[0.625rem] leading-relaxed text-ink-faint">
          Computer-generated receipt — no signature required.
          <br />
          This is an acknowledgement of an amount received by the society. It is not a
          tax-deductible donation receipt.
        </p>
      </div>

      {donation.receiptSentAt ? (
        <Badge tone="credit" className="mt-3">
          Already sent
        </Badge>
      ) : null}

      <div className="mt-4">
        <Field
          label="Contributor's WhatsApp number"
          hint="WhatsApp opens on their chat with this receipt typed out — you just tap send."
        >
          <input
            className="field tnum"
            type="tel"
            inputMode="numeric"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="98200 11234"
          />
        </Field>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-ink-soft hover:text-ink">
          Preview the WhatsApp message
        </summary>
        <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-surface-sunken p-3 font-sans text-[0.75rem] leading-relaxed text-ink-soft">
          {text}
        </pre>
      </details>
    </Sheet>
  );
}

/** Turns a stored data URL back into a File so it can go into a share sheet. */
async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}

/**
 * The two ways to send a receipt, side by side.
 *
 * Text goes straight to the resident's chat because a `wa.me` link can carry a
 * number — but WhatsApp deep links cannot carry a file, so sending the proof
 * photograph has to go through the phone's share sheet, where the volunteer
 * picks the contact. Both are free; neither needs Meta approval.
 */
export function ReceiptActions({ donation }: { donation: Donation }) {
  const { data, markReceiptSent } = useSociety();
  const { activityById, memberById } = useLookups();
  const toast = useToast();
  const [sharing, setSharing] = useState(false);

  const activity = donation.activityId ? activityById.get(donation.activityId) ?? null : null;
  const receivedBy = memberById.get(donation.recordedBy)?.name ?? "Committee";
  const text = receiptMessage(donation, data.society, activity, receivedBy);

  function sendText() {
    const number = toWhatsAppNumber(donation.donorMobile ?? "");
    if (!number) {
      toast("Add the contributor's WhatsApp number first.", "error");
      return;
    }
    const opened = window.open(
      `https://wa.me/${number}?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
    if (!opened) {
      void navigator.clipboard
        .writeText(text)
        .then(() => toast("WhatsApp didn't open — the receipt is on your clipboard."))
        .catch(() => toast("Could not open WhatsApp.", "error"));
      return;
    }
    void markReceiptSent(donation.id);
  }

  async function sendWithProof() {
    if (!donation.proofSrc) {
      toast("Capture the proof photograph first.", "error");
      return;
    }
    setSharing(true);
    try {
      const file = await dataUrlToFile(
        donation.proofSrc,
        `receipt-${donation.receiptNo.replace(/\//g, "-")}.jpg`,
      );
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        void markReceiptSent(donation.id);
      } else {
        // Desktop, or a browser without file sharing — download it instead so
        // the volunteer can attach it manually.
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
        toast("Saved the proof photo — attach it in WhatsApp.");
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        toast("Could not share the photo.", "error");
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={sendText} disabled={!donation.donorMobile}>
        <WhatsAppIcon />
        Send receipt
      </Button>
      {donation.proofSrc ? (
        <Button size="sm" variant="secondary" onClick={sendWithProof} disabled={sharing}>
          {sharing ? "Preparing…" : "Send with proof photo"}
        </Button>
      ) : null}
      {donation.receiptSentAt ? <Badge tone="credit">Sent</Badge> : null}
    </div>
  );
}

/** Small inline trigger used on donation rows. */
export function ReceiptButton({ donation }: { donation: Donation }) {
  const [open, setOpen] = useState(false);
  const { canCollect } = useSociety();
  if (!canCollect) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[0.6875rem] font-medium text-ink-soft underline decoration-line-strong underline-offset-2 hover:text-ink"
      >
        {donation.receiptSentAt ? "Receipt ✓" : "Receipt"}
      </button>
      {open ? <ReceiptSheet donation={donation} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** Shown right after recording, so the receipt goes out while the donor is there. */
export function ReceiptPrompt({
  donation,
  onDismiss,
}: {
  donation: Donation;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-xl border border-brand/20 bg-brand-soft px-4 py-3">
      <p className="text-[0.8125rem] font-medium text-brand-ink">
        {money(donation.amount)} recorded · receipt {donation.receiptNo}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <ReceiptButton donation={donation} />
        <button
          type="button"
          onClick={onDismiss}
          className="text-[0.6875rem] text-ink-faint hover:text-ink-soft"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
