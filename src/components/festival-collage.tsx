"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

/**
 * The festival, as a wall of photographs.
 *
 * Pinned up rather than filed: each picture sits on a white mount at a slight
 * angle, the way they would if someone had actually put them on a noticeboard.
 * The tilt is fixed per position — a random one would jump every time React
 * re-rendered, and a photo that moves when you scroll past is a bug, not a
 * flourish.
 *
 * They drift, very slightly, on a long cycle. Enough that the page feels alive
 * on a phone and not so much that anyone reading the names underneath is
 * fighting it. The whole thing stops dead under `prefers-reduced-motion`, which
 * the stylesheet already enforces for every animation.
 *
 * Twelve at a time. A committee member with three hundred pictures should not
 * be able to make the thanks page take a minute to load by accident.
 */

const FIRST_SHOWN = 12;

/** Fixed per position, so a photo keeps its angle across renders. */
const TILT = [-2.2, 1.6, -1.1, 2.4, -1.8, 0.9, 2.1, -2.5, 1.2, -0.8, 1.9, -1.5];

/** Varied, so the wall breathes unevenly rather than in unison. */
const DRIFT = [7.5, 9, 8.2, 10.5, 7.9, 9.6];

export function FestivalCollage({ photos }: { photos: string[] }) {
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  const shown = all ? photos : photos.slice(0, FIRST_SHOWN);

  const move = useCallback(
    (by: number) =>
      setOpen((i) => (i === null ? null : (i + by + photos.length) % photos.length)),
    [photos.length],
  );

  useEffect(() => {
    if (open === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowLeft") move(-1);
    }
    window.addEventListener("keydown", onKey);
    // The page behind a full-screen photo should not scroll under it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, move]);

  if (!photos.length) return null;

  return (
    <section className="mb-9">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={`Open photograph ${i + 1} of ${photos.length}`}
            className="collage-tile relative block rounded-[10px] bg-surface p-1.5 shadow-sm ring-1 ring-line"
            style={
              {
                "--tilt": `${TILT[i % TILT.length]}deg`,
                "--drift": `${DRIFT[i % DRIFT.length]}s`,
                "--enter": `${Math.min(i, 11) * 60}ms`,
              } as React.CSSProperties
            }
          >
            <span className="relative block aspect-square overflow-hidden rounded-[6px] bg-surface-sunken">
              <Image
                src={src}
                alt=""
                fill
                sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw"
                className="object-cover"
              />
            </span>
          </button>
        ))}
      </div>

      {photos.length > FIRST_SHOWN && !all ? (
        <p className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setAll(true)}
            className="text-xs font-medium text-brand underline decoration-brand/30 underline-offset-2"
          >
            Show all {photos.length} photos
          </button>
        </p>
      ) : null}

      {open !== null ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photograph"
          onClick={() => setOpen(null)}
          className="animate-fade-in fixed inset-0 z-50 grid place-items-center bg-ink/85 p-4"
        >
          <div className="relative h-full max-h-[80dvh] w-full max-w-3xl">
            <Image src={photos[open]} alt="" fill sizes="100vw" className="object-contain" priority />
          </div>

          {photos.length > 1 ? (
            <>
              <Nav side="left" onClick={() => move(-1)} />
              <Nav side="right" onClick={() => move(1)} />
            </>
          ) : null}

          <p className="pointer-events-none absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] left-0 right-0 text-center text-xs text-white/70">
            {open + 1} of {photos.length} · tap anywhere to close
          </p>
        </div>
      ) : null}
    </section>
  );
}

function Nav({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Previous photograph" : "Next photograph"}
      onClick={(e) => {
        // Without this the click reaches the backdrop and closes the viewer.
        e.stopPropagation();
        onClick();
      }}
      className={`absolute top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25 ${
        side === "left" ? "left-3" : "right-3"
      }`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d={side === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
