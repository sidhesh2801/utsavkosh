"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLookups, useSociety } from "@/lib/store";
import { shortDate, toDateInput } from "@/lib/format";
import {
  Button,
  Card,
  EmptyState,
  Field,
  PageHeader,
  Sheet,
  useToast,
} from "@/components/ui";
import { PhotoTile } from "@/components/photo";

export default function GalleryPage() {
  const { data, isAdmin } = useSociety();
  const { photosByAlbumId } = useLookups();
  const [creating, setCreating] = useState(false);

  const albums = useMemo(
    () => [...data.albums].sort((a, b) => b.date.localeCompare(a.date)),
    [data.albums],
  );

  return (
    <div>
      <PageHeader
        title="Photo gallery"
        subtitle="Every celebration the society has held, album by album."
        actions={isAdmin ? <Button onClick={() => setCreating(true)}>New album</Button> : undefined}
      />

      {albums.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => {
            const photos = photosByAlbumId.get(album.id) ?? [];
            const cover = photos.slice(0, 4);
            return (
              <Card as="li" key={album.id} className="overflow-hidden transition-shadow hover:shadow-sm">
                <Link href={`/gallery/${album.id}`} className="block">
                  {cover.length ? (
                    <div className="grid grid-cols-2 gap-[2px] bg-surface p-[2px]">
                      {cover.map((p) => (
                        <PhotoTile key={p.id} photo={p} className="rounded-none" />
                      ))}
                      {/* Keep the 2×2 grid square when an album has fewer than four. */}
                      {Array.from({ length: Math.max(0, 4 - cover.length) }).map((_, i) => (
                        <div key={i} className="aspect-square bg-surface-sunken" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid aspect-[2/1] place-items-center bg-surface-sunken text-xs text-ink-faint">
                      No photographs yet
                    </div>
                  )}
                  <div className="px-4 py-3">
                    <h2 className="text-[0.9375rem] font-semibold leading-snug text-ink">
                      {album.title}
                    </h2>
                    <p className="tnum mt-0.5 text-xs text-ink-soft">
                      {shortDate(album.date)} · {photos.length}{" "}
                      {photos.length === 1 ? "photo" : "photos"}
                    </p>
                    {album.description ? (
                      <p className="mt-1.5 line-clamp-2 text-[0.8125rem] leading-relaxed text-ink-soft">
                        {album.description}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </Card>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title="No albums yet"
          description="Create an album for an event and start adding photographs from the celebration."
          action={isAdmin ? <Button onClick={() => setCreating(true)}>New album</Button> : undefined}
        />
      )}

      {creating ? <AlbumForm open onClose={() => setCreating(false)} /> : null}
    </div>
  );
}

export function AlbumForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, addAlbum } = useSociety();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [activityId, setActivityId] = useState("");
  const [date, setDate] = useState(toDateInput(new Date().toISOString()));
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Picking an activity fills the album title and date to match it. */
  function pickActivity(id: string) {
    setActivityId(id);
    const activity = data.activities.find((a) => a.id === id);
    if (activity) {
      if (!title.trim()) setTitle(activity.title);
      setDate(toDateInput(activity.startsAt));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await addAlbum({
      title,
      activityId: activityId || null,
      date,
      description: description.trim() || undefined,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast("Album created — you can add photographs to it now.");
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New album"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Creating…" : "Create album"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="For which activity" hint="Links the album to the event's page.">
          <select className="field" value={activityId} onChange={(e) => pickActivity(e.target.value)}>
            <option value="">Not linked to an activity</option>
            {data.activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Album name" required>
          <input
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g. Janmashtami & Dahi Handi 2026"
          />
        </Field>
        <Field label="Date" required>
          <input
            className="field"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </Field>
        <Field label="Description">
          <textarea
            className="field resize-y"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A line about the celebration."
          />
        </Field>
        {error ? (
          <p role="alert" className="rounded-lg bg-debit-soft px-3 py-2 text-[0.8125rem] text-debit">
            {error}
          </p>
        ) : null}
      </form>
    </Sheet>
  );
}
