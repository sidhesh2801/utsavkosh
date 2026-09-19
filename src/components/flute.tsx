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
 * Once playing it stays playing for as long as the page is open: it loops, it
 * survives moving between Donations, Ledger and Thanks (this lives in the app
 * shell, which those pages share), and it picks itself back up after the phone
 * interrupts it. Closing the tab is what stops it.
 */

const SRC = "/flute.mp3";
const REMEMBER = "utsavkosh:flute";

/** Quiet. This is background, and someone else chose to hear it, not to be told. */
const VOLUME = 0.35;

export function Flute() {
  const audio = useRef<HTMLAudioElement | null>(null);
  /**
   * What the listener asked for, as opposed to what the element is doing.
   * A ref rather than state because the media event handlers below read it
   * long after the render that created them.
   */
  const wants = useRef(false);

  const [broken, setBroken] = useState(false);
  const [playing, setPlaying] = useState(false);
  /**
   * Whether they had it on last time. Read after mount rather than during
   * render — localStorage does not exist on the server, and a value that
   * differs between the two is a hydration mismatch. It only marks the button;
   * it never starts the audio.
   */
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    setAsked(localStorage.getItem(REMEMBER) === "1");
    const el = new Audio(SRC);
    el.loop = true;
    el.volume = VOLUME;
    // Nothing is fetched until the first tap. The track is a few megabytes and
    // most visitors come for the donation list, not the music.
    el.preload = "none";
    audio.current = el;

    /**
     * A phone call, a headphone unplugged, iOS reclaiming audio when the tab
     * goes to the background: the element pauses and nothing tells the page.
     * If the listener never asked for silence, ask for the sound back.
     */
    function resume() {
      if (!wants.current || !audio.current || document.hidden) return;
      void audio.current.play().catch(() => {});
    }

    function onPause() {
      // A beat, so this does not race the pause the button itself caused.
      setTimeout(resume, 150);
    }

    function onError() {
      setBroken(true);
      setPlaying(false);
    }

    el.addEventListener("pause", onPause);
    el.addEventListener("error", onError);
    document.addEventListener("visibilitychange", resume);

    return () => {
      wants.current = false;
      el.removeEventListener("pause", onPause);
      el.removeEventListener("error", onError);
      document.removeEventListener("visibilitychange", resume);
      el.pause();
      audio.current = null;
    };
  }, []);

  // A missing or unplayable file should leave no trace on the page — better an
  // absent control than one that does nothing when pressed.
  if (broken) return null;

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
          wants.current = false;
          el.pause();
          setPlaying(false);
          setAsked(false);
          localStorage.setItem(REMEMBER, "0");
          return;
        }
        wants.current = true;
        void el
          .play()
          .then(() => {
            setPlaying(true);
            setAsked(true);
            localStorage.setItem(REMEMBER, "1");
          })
          // Refused by the browser, or the file will not decode. Either way,
          // saying nothing is better than an error about background music.
          .catch(() => {
            wants.current = false;
            setPlaying(false);
          });
      }}
      className={`fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-40 grid h-11 w-11 place-items-center rounded-full border border-line shadow-sm transition-colors md:bottom-6 ${
        playing ? "bg-brand text-white" : "bg-surface text-ink-soft hover:text-ink"
      } ${asked && !playing ? "ring-2 ring-brand/30" : ""}`}
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
