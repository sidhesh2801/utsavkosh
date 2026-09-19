"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A flute, if the resident wants one.
 *
 * Off every time the page loads, and there is no setting that changes that.
 * Browsers block sound that starts on its own, which is the right instinct
 * written into the platform: somebody opens the ledger on a bus, in an office,
 * next to a sleeping child. A festival page is not worth that.
 *
 * So it is a button. Tap once and it plays; the choice is remembered, but only
 * so the button comes back pressed — the audio still waits for a tap, because
 * a remembered preference is not the same as permission on this page load.
 *
 * The button hides itself when there is no audio file. Better an absent
 * control than one that does nothing when pressed.
 */

const SRC = "/flute.mp3";
const REMEMBER = "utsavkosh:flute";

/** Quiet. This is background, and someone else chose to hear it, not to be told. */
const VOLUME = 0.35;

export function Flute() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [available, setAvailable] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = new Audio(SRC);
    el.loop = true;
    el.volume = VOLUME;
    el.preload = "metadata";
    // Only show the button once the browser confirms there is something to
    // play. A missing file should leave no trace on the page.
    el.addEventListener("loadedmetadata", () => setAvailable(true));
    el.addEventListener("error", () => setAvailable(false));
    audio.current = el;
    return () => {
      el.pause();
      audio.current = null;
    };
  }, []);

  if (!available) return null;

  const wanted = typeof window !== "undefined" && localStorage.getItem(REMEMBER) === "1";

  return (
    <button
      type="button"
      aria-pressed={playing}
      aria-label={playing ? "Stop the flute" : "Play the flute"}
      title={playing ? "Stop the flute" : "Play a flute"}
      onClick={() => {
        const el = audio.current;
        if (!el) return;
        if (playing) {
          el.pause();
          setPlaying(false);
          localStorage.setItem(REMEMBER, "0");
          return;
        }
        void el
          .play()
          .then(() => {
            setPlaying(true);
            localStorage.setItem(REMEMBER, "1");
          })
          // Refused by the browser, or the file will not decode. Either way,
          // saying nothing is better than an error about background music.
          .catch(() => setPlaying(false));
      }}
      className={`fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-40 grid h-11 w-11 place-items-center rounded-full border border-line shadow-sm transition-colors md:bottom-6 ${
        playing ? "bg-brand text-white" : "bg-surface text-ink-soft hover:text-ink"
      } ${wanted && !playing ? "ring-2 ring-brand/30" : ""}`}
    >
      {playing ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M11 5 6 9H3v6h3l5 4V5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M11 5 6 9H3v6h3l5 4V5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M16 10l5 4M21 10l-5 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
