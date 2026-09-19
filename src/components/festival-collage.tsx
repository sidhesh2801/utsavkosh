"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui";

/**
 * The festival, as a wall of photographs.
 *
 * Two sources, deliberately. The ones in `public/collage/` are committed to the
 * repository and are there on the first paint; the rest were uploaded by
 * volunteers through the app and arrive a moment later. Anyone holding a photo
 * can get it onto the page — whether or not they can push a commit.
 *
 * Pinned up rather than filed: each picture sits on a white mount at a slight
 * angle, the way they would if someone had put them on a noticeboard. The tilt
 * is fixed per position — a random one would jump every time React re-rendered,
 * and a photo that moves when you scroll past is a bug, not a flourish.
 *
 * They drift, very slightly, on staggered clocks. Enough that the page feels
 * alive on a phone and not so much that anyone reading the names underneath is
 * fighting it. It all stops under `prefers-reduced-motion`.
 *
 * Twelve at a time. A committee member with three hundred pictures should not
 * be able to make the thanks page take a minute to load by accident.
 */

interface Photo {
  url: string;
  /** Set only for uploads: the object name, and so the handle to remove it. */
  name?: string;
}

const FIRST_SHOWN = 12;

/** Fixed per position, so a photo keeps its angle across renders. */
const TILT = [-2.2, 1.6, -1.1, 2.4, -1.8, 0.9, 2.1, -2.5, 1.2, -0.8, 1.9, -1.5];

/** Varied, so the wall breathes unevenly rather than in unison. */
const DRIFT = [7.5, 9, 8.2, 10.5, 7.9, 9.6];

export function FestivalCollage({
  photos: fromRepo,
  canEdit,
}: {
  photos: string[];
  canEdit: boolean;
}) {
  const toast = useToast();
  const [uploaded, setUploaded] = useState<Photo[]>([]);
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(0);
  const picker = useRef<HTMLInputElement>(null);

  const photos: Photo[] = [...fromRepo.map((url) => ({ url })), ...uploaded];

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/collage");
      if (!res.ok) return;
      const d = (await res.json()) as { photos?: Photo[] };
      setUploaded(d.photos ?? []);
    } catch {
      // The repo's own photos are already on screen; an unreachable bucket
      // should take nothing away from them.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

  /**
   * One request per file rather than one for all of them: a phone on society
   * wi-fi drops a 40 MB post, and six photos where five arrived is a better
   * outcome than six where none did.
   */
  async function send(files: FileList) {
    const chosen = [...files];
    setBusy(chosen.length);
    let failed = 0;
    let lastError = "";
    for (const file of chosen) {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/collage", { method: "POST", body: form });
      if (!res.ok) {
        failed += 1;
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        lastError = d.error ?? "";
      }
      setBusy((n) => n - 1);
    }
    await load();
    if (!failed) {
      toast(chosen.length === 1 ? "Photo added." : `${chosen.length} photos added.`);
    } else {
      toast(lastError || `${failed} of ${chosen.length} didn't upload.`, "error");
    }
  }

  async function remove(name: string) {
    if (!window.confirm("Remove this photo from the collage?")) return;
    const res = await fetch(`/api/collage?name=${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
    if (!res.ok) return toast("Could not remove it.", "error");
    setOpen(null);
    toast("Photo removed.");
    void load();
  }

  const shown = all ? photos : photos.slice(0, FIRST_SHOWN);

  // Nothing to show and nothing anyone can do about it: stay out of the way.
  if (!photos.length && !canEdit) return null;

  return (
    <section className="mb-9">
      {photos.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((p, i) => (
            <button
              key={p.url}
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
                  src={p.url}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw"
                  className="object-cover"
                />
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {photos.length > FIRST_SHOWN && !all ? (
          <button
            type="button"
            onClick={() => setAll(true)}
            className="text-xs font-medium text-brand underline decoration-brand/30 underline-offset-2"
          >
            Show all {photos.length} photos
          </button>
        ) : null}

        {canEdit ? (
          <>
            <input
              ref={picker}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files?.length) void send(e.target.files);
                // Cleared, so choosing the same file twice still fires.
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={busy > 0}
              onClick={() => picker.current?.click()}
              className="text-xs font-medium text-brand underline decoration-brand/30 underline-offset-2 disabled:opacity-50"
            >
              {busy > 0
                ? `Uploading… ${busy} left`
                : photos.length
                  ? "Add photos"
                  : "Add the first photos"}
            </button>
          </>
        ) : null}
      </div>

      {open !== null && photos[open] ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photograph"
          onClick={() => setOpen(null)}
          className="animate-fade-in fixed inset-0 z-50 grid place-items-center bg-ink/85 p-4"
        >
          <div className="relative h-full max-h-[80dvh] w-full max-w-3xl">
            <Image
              src={photos[open].url}
              alt=""
              fill
              sizes="100vw"
              className="object-contain"
              priority
            />
          </div>

          {photos.length > 1 ? (
            <>
              <Nav side="left" onClick={() => move(-1)} />
              <Nav side="right" onClick={() => move(1)} />
            </>
          ) : null}

          <p className="absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] left-0 right-0 text-center text-xs text-white/70">
            {open + 1} of {photos.length} · tap anywhere to close
            {canEdit && photos[open].name ? (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void remove(photos[open].name!);
                  }}
                  className="font-medium text-white/90 underline underline-offset-2"
                >
                  Remove
                </button>
              </>
            ) : null}
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
