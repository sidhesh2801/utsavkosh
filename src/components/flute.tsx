"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A flute, playing as soon as the browser will let it.
 *
 * It tries the moment the page loads. That almost always fails, and not
 * because of a bug: every browser refuses sound that no one asked for, and
 * `play()` rejects. So the second attempt is armed behind the first touch,
 * click, key or scroll anywhere on the page — the gesture the browser is
 * waiting for. In practice somebody scrolls the donations list within a second
 * or two and the flute comes in then, which is as close to automatic as the
 * platform permits. There is no trick that gets past this, only muted
 * playback, which is not music.
 *
 * Whoever turns it off is not asked twice: that choice is remembered, and the
 * auto-start is skipped on their next visit until they press the button again.
 *
 * Once playing it stays playing for as long as the page is open: it loops, it
 * survives moving between Donations, Ledger and Thanks (this lives in the app
 * shell, which those pages share), and it picks itself back up after the phone
 * interrupts it. Closing the tab is what stops it.
 */

/**
 * Two minutes of bansuri, cut to loop.
 *
 * The source was a six-minute 256 kbps stereo MP3 from Pixabay, 11.7 MB. Most
 * of this society reads the app on a phone on mobile data and it must not cost
 * them anything to look at, so what ships is two minutes of it at 62 kbps mono
 * AAC: 968 KB, and indistinguishable under a donations list.
 *
 * Two minutes because it repeats anyway. The cut is not a cut — the three
 * seconds after the end are crossfaded back over the three seconds at the
 * start, so playing it end-to-start is a fade rather than a join and the loop
 * has no click in it. It also begins twenty seconds in, past the intro, which
 * would otherwise have faded up every two minutes.
 *
 * AAC only, no MP3 fallback: there is no MP3 encoder on the machine that built
 * this, and every browser made this century plays AAC in MP4. If one somehow
 * cannot, the error handler below takes the button off the page.
 */
const SRC = "/flute.m4a";

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
  /**
   * Unhooks the waiting-for-a-gesture listeners. Held in a ref because the
   * button has to be able to call it: someone who presses stop before their
   * first scroll would otherwise have the music start on that scroll, having
   * just said no.
   */
  const disarmRef = useRef<() => void>(() => {});

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
    // Only an explicit "no" stops the auto-start. A first-time visitor has
    // expressed nothing, and the festival page is meant to have music.
    const refused = localStorage.getItem(REMEMBER) === "0";
    setAsked(!refused);

    const el = new Audio(SRC);
    el.loop = true;
    el.volume = VOLUME;
    // Nothing is fetched until it is actually going to play. Someone who opens
    // the donations list, reads it and leaves without ever scrolling pays for
    // no audio at all; at 62 kbps, enough to start arrives almost at once.
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

    /**
     * The gestures a browser accepts as "the visitor is here and doing
     * something". Scroll is the one that usually fires first on a phone, and
     * it is passive so it cannot slow the list down.
     */
    const GESTURES = ["pointerdown", "touchstart", "keydown", "scroll"] as const;

    function start() {
      if (!audio.current || refused) return;
      wants.current = true;
      void audio.current
        .play()
        .then(() => {
          setPlaying(true);
          disarm();
        })
        // Refused for want of a gesture. Leave the listeners armed; the next
        // one the visitor makes is the one that works.
        .catch(() => {
          wants.current = false;
        });
    }

    function disarm() {
      for (const g of GESTURES) window.removeEventListener(g, start);
    }
    disarmRef.current = disarm;

    if (!refused) {
      // Worth trying: a visitor who has used this site before may already have
      // earned the browser's permission, and then the music is simply on.
      start();
      for (const g of GESTURES) window.addEventListener(g, start, { passive: true });
    }

    return () => {
      wants.current = false;
      disarm();
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
          disarmRef.current();
          el.pause();
          setPlaying(false);
          setAsked(false);
          localStorage.setItem(REMEMBER, "0");
          return;
        }
        wants.current = true;
        // Explicitly asked for, so it is no longer waiting on a gesture.
        disarmRef.current();
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
