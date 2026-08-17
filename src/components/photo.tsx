"use client";

import { useCallback, useEffect } from "react";
import type { Photo } from "@/lib/types";

/**
 * Placeholder tiles for the sample gallery.
 *
 * The seeded albums have captions but no image files, so each tile renders a
 * deterministic gradient derived from its id — stable across reloads, varied
 * across a grid, and clearly a placeholder rather than a broken image. Real
 * uploads replace these entirely.
 */
const GRADIENTS = [
  ["#0e5c4b", "#2f8f6e"],
  ["#b8500f", "#e0913c"],
  ["#3c4f7a", "#7089b8"],
  ["#7a3352", "#b8748c"],
  ["#5c5220", "#a3944a"],
  ["#2d5f66", "#68a3a8"],
  ["#6b3a1f", "#b07a4e"],
  ["#40405e", "#8080a3"],
];

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function Placeholder({ id, caption }: { id: string; caption?: string }) {
  const [from, to] = GRADIENTS[hash(id) % GRADIENTS.length];
  const angle = 120 + (hash(id) % 5) * 25;
  return (
    <div
      className="flex h-full w-full items-end p-2.5"
      style={{ background: `linear-gradient(${angle}deg, ${from}, ${to})` }}
    >
      {caption ? (
        <span className="line-clamp-3 text-[0.6875rem] font-medium leading-snug text-white/95 drop-shadow">
          {caption}
        </span>
      ) : null}
    </div>
  );
}

export function PhotoTile({
  photo,
  onOpen,
  className = "",
}: {
  photo: Photo;
  onOpen?: () => void;
  className?: string;
}) {
  const inner = photo.src ? (
    // Local data URLs; next/image would add no value and needs config for these.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.src}
      alt={photo.caption || "Society photograph"}
      loading="lazy"
      className="h-full w-full object-cover"
    />
  ) : (
    <Placeholder id={photo.id} caption={photo.caption} />
  );

  if (!onOpen) {
    return (
      <div className={`aspect-square overflow-hidden rounded-xl bg-surface-sunken ${className}`}>
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={photo.caption ? `View: ${photo.caption}` : "View photograph"}
      className={`group aspect-square overflow-hidden rounded-xl bg-surface-sunken transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md ${className}`}
    >
      {inner}
    </button>
  );
}

export function Lightbox({
  photos,
  index,
  onClose,
  onNavigate,
}: {
  photos: Photo[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const photo = photos[index];

  const step = useCallback(
    (delta: number) => {
      const next = (index + delta + photos.length) % photos.length;
      onNavigate(next);
    },
    [index, photos.length, onNavigate],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, step]);

  if (!photo) return null;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[70] flex flex-col bg-ink/95"
      role="dialog"
      aria-modal="true"
      aria-label="Photograph viewer"
    >
      <div className="flex items-center justify-between px-4 py-3 text-white/80">
        <span className="tnum text-sm">
          {index + 1} / {photos.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close viewer"
          className="rounded-lg p-2 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        {photos.length > 1 ? (
          <NavButton side="left" onClick={() => step(-1)} />
        ) : null}

        <div className="max-h-full max-w-3xl overflow-hidden rounded-xl">
          {photo.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.src}
              alt={photo.caption || "Society photograph"}
              className="max-h-[70vh] w-auto object-contain"
            />
          ) : (
            <div className="aspect-[4/3] w-[min(90vw,42rem)]">
              <Placeholder id={photo.id} />
            </div>
          )}
        </div>

        {photos.length > 1 ? <NavButton side="right" onClick={() => step(1)} /> : null}
      </div>

      <div className="px-6 py-5 text-center">
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/85">
          {photo.caption || <span className="text-white/50">No caption</span>}
        </p>
        {!photo.src ? (
          <p className="mt-2 text-xs text-white/45">
            Sample placeholder — uploaded photographs appear here in full.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function NavButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous photograph" : "Next photograph"}
      className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white/80 transition-colors hover:bg-white/20 hover:text-white ${
        side === "left" ? "left-2" : "right-2"
      }`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d={side === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
