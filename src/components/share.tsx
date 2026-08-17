"use client";

import { useState } from "react";
import { Button, Sheet, useToast } from "./ui";

/**
 * Hands a composed message to WhatsApp.
 *
 * On a phone, `navigator.share` opens the native sheet, which lets the admin
 * pick the society group directly. Elsewhere it falls back to a wa.me link,
 * which opens WhatsApp Web with the text pre-filled and a chat picker.
 */
async function shareToWhatsApp(text: string, onCopied: () => void): Promise<void> {
  const canNativeShare =
    typeof navigator !== "undefined" &&
    "share" in navigator &&
    // Desktop Chrome advertises share but routes it poorly; phones are the target.
    /Android|iPhone|iPad/i.test(navigator.userAgent);

  if (canNativeShare) {
    try {
      await navigator.share({ text });
      return;
    } catch (err) {
      // The user dismissing the share sheet is not an error worth reporting.
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }

  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    // Pop-up blocked — leave the text on the clipboard so nothing is lost.
    try {
      await navigator.clipboard.writeText(text);
      onCopied();
    } catch {
      /* clipboard denied too; the preview sheet still shows the text */
    }
  }
}

const WhatsAppIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.06c-.24.68-1.4 1.3-1.93 1.35-.53.05-1.02.15-3.5-.85-2.97-1.2-4.83-4.28-4.98-4.48-.14-.2-1.17-1.62-1.17-3.1 0-1.47.77-2.19 1.05-2.49.27-.3.6-.37.8-.37.19 0 .39 0 .56.01.18.01.42-.07.66.5.24.58.83 2.02.9 2.17.07.15.12.32.02.51-.1.2-.15.32-.3.5-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.3.76 1.25 1.63 2.03 1.12 1 2.06 1.31 2.36 1.46.29.15.46.12.63-.07.17-.2.73-.85.92-1.14.2-.3.39-.25.66-.15.27.1 1.7.8 1.99.95.29.15.48.22.55.34.07.13.07.73-.17 1.41Z" />
  </svg>
);

export function ShareButton({
  message,
  label = "Share on WhatsApp",
  variant = "secondary",
  size = "md",
  /** Show the message before sending — worth it for money updates. */
  preview = true,
}: {
  message: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  preview?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(message);
  const toast = useToast();

  const send = (text: string) =>
    shareToWhatsApp(text, () => toast("WhatsApp didn't open — the message is on your clipboard."));

  if (!preview) {
    return (
      <Button variant={variant} size={size} onClick={() => void send(message)}>
        <WhatsAppIcon />
        {label}
      </Button>
    );
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => {
          setDraft(message);
          setOpen(true);
        }}
      >
        <WhatsAppIcon />
        {label}
      </Button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Send to the society group"
        description="Edit anything you like, then WhatsApp opens with this text ready. Pick the group and hit send."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setOpen(false);
                void send(draft);
              }}
            >
              <WhatsAppIcon />
              Open WhatsApp
            </Button>
          </>
        }
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={16}
          aria-label="Message text"
          className="field resize-y font-sans text-[0.8125rem] leading-relaxed"
        />
        <p className="mt-2 text-xs text-ink-faint">
          WhatsApp shows *text between asterisks* in bold and _text between underscores_ in italics.
        </p>
      </Sheet>
    </>
  );
}
