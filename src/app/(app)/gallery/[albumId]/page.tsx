"use client";

import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useLookups, useSociety } from "@/lib/store";
import { shortDate } from "@/lib/format";
import { albumMessage } from "@/lib/messages";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Sheet,
  Skeleton,
  useConfirm,
  useToast,
} from "@/components/ui";
import { ShareButton } from "@/components/share";
import { Lightbox, PhotoTile } from "@/components/photo";
import type { Photo } from "@/lib/types";

export default function AlbumPage() {
  const { albumId } = useParams<{ albumId: string }>();
  const { data, ready, isAdmin, addPhotos, deleteAlbum } = useSociety();
  const { photosByAlbumId, activityById } = useLookups();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [viewing, setViewing] = useState<number | null>(null);
  const [captioning, setCaptioning] = useState<Photo | null>(null);
  const [uploading, setUploading] = useState(false);

  const album = data.albums.find((a) => a.id === albumId);
  if (!ready) return <Skeleton className="h-72" />;
  if (!album) notFound();

  const photos = (photosByAlbumId.get(album.id) ?? [])
    .slice()
    .sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
  const activity = album.activityId ? activityById.get(album.activityId) : null;

  async function onFilesPicked(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const result = await addPhotos(album!.id, Array.from(files));
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
    toast(
      result.ok
        ? `${result.value} ${result.value === 1 ? "photograph" : "photographs"} added.`
        : result.error,
      result.ok ? "success" : "error",
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href="/gallery"
        className="inline-flex items-center gap-1 text-[0.8125rem] text-ink-soft transition-colors hover:text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M15 5l-7 7 7 7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        All albums
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[1.375rem] font-semibold tracking-[-0.01em] text-ink sm:text-2xl">
            {album.title}
          </h1>
          <p className="tnum mt-1 text-sm text-ink-soft">
            {shortDate(album.date)} · {photos.length} {photos.length === 1 ? "photo" : "photos"}
            {activity ? (
              <>
                {" · "}
                <Link
                  href={`/activities/${activity.id}`}
                  className="text-brand underline decoration-brand/30 underline-offset-2"
                >
                  {activity.title}
                </Link>
              </>
            ) : null}
          </p>
          {album.description ? (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
              {album.description}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ShareButton
            size="sm"
            label="Share album"
            message={albumMessage(data.society, album, photos.length)}
          />
          {isAdmin ? (
            <>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => void onFilesPicked(e.target.files)}
              />
              <Button size="sm" onClick={() => fileInput.current?.click()} disabled={uploading}>
                {uploading ? "Adding…" : "Add photographs"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  if (
                    !confirm(
                      `Delete the album “${album.title}” and all ${photos.length} photographs in it? This cannot be undone.`,
                    )
                  )
                    return;
                  const r = await deleteAlbum(album.id);
                  if (!r.ok) toast(r.error, "error");
                  else {
                    toast("Album deleted.");
                    router.push("/gallery");
                  }
                }}
              >
                Delete album
              </Button>
            </>
          ) : null}
        </div>
      </header>

      {photos.length ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo, i) => (
            <li key={photo.id} className="relative">
              <PhotoTile photo={photo} onOpen={() => setViewing(i)} className="w-full" />
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => setCaptioning(photo)}
                  className="absolute bottom-1.5 right-1.5 rounded-md bg-ink/70 px-2 py-1 text-[0.625rem] font-medium text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 hover:bg-ink"
                >
                  Edit
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No photographs in this album yet"
          description={
            isAdmin
              ? "Add photographs from your phone or computer. They're resized automatically before being saved."
              : "The committee hasn't uploaded photographs for this album yet."
          }
          action={
            isAdmin ? (
              <Button onClick={() => fileInput.current?.click()}>Add photographs</Button>
            ) : undefined
          }
        />
      )}

      {isAdmin && photos.length ? (
        <Card className="p-4">
          <p className="text-xs leading-relaxed text-ink-soft">
            Photographs are downscaled to 1600px and re-encoded before being stored, so a full
            album stays small. Hover or focus a photograph to edit its caption.
          </p>
        </Card>
      ) : null}

      {viewing !== null ? (
        <Lightbox
          photos={photos}
          index={viewing}
          onClose={() => setViewing(null)}
          onNavigate={setViewing}
        />
      ) : null}

      {captioning ? (
        <CaptionForm photo={captioning} onClose={() => setCaptioning(null)} />
      ) : null}
    </div>
  );
}

function CaptionForm({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  const { updatePhoto, deletePhoto } = useSociety();
  const toast = useToast();
  const confirm = useConfirm();
  const [caption, setCaption] = useState(photo.caption ?? "");

  return (
    <Sheet
      open
      onClose={onClose}
      title="Photograph"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={async () => {
              if (!confirm("Delete this photograph?")) return;
              const r = await deletePhoto(photo.id);
              toast(r.ok ? "Photograph deleted." : r.error, r.ok ? "success" : "error");
              onClose();
            }}
          >
            Delete
          </Button>
          <Button
            className="ml-auto"
            onClick={async () => {
              const r = await updatePhoto(photo.id, { caption: caption.trim() });
              toast(r.ok ? "Caption saved." : r.error, r.ok ? "success" : "error");
              onClose();
            }}
          >
            Save caption
          </Button>
        </>
      }
    >
      <div className="mb-4 overflow-hidden rounded-xl">
        <PhotoTile photo={photo} />
      </div>
      <Field label="Caption">
        <input
          className="field"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="e.g. Flag hoisting by our senior-most resident"
          autoFocus
        />
      </Field>
    </Sheet>
  );
}
