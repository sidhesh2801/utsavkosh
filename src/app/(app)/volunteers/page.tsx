"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  Field,
  PageHeader,
  SectionTitle,
  Sheet,
  useToast,
} from "@/components/ui";
import { useCommitteeSession } from "@/components/ledger-admin";
import { FestivalCollage } from "@/components/festival-collage";

interface Volunteer {
  id: string;
  name: string;
  flat: string;
  role: string;
  note: string;
  photoUrl: string;
}

/**
 * The people who ran the festival.
 *
 * The app has recorded every rupee since August and, until now, none of the
 * people who carried the chairs or stood at the food counter for two days. A
 * society that publishes its money and not its volunteers has said something
 * about what it counts.
 *
 * Grouped by what people did rather than listed flat, because that is how the
 * festival was actually organised and because a single alphabetical column of
 * forty names is a list nobody reads to the end of.
 *
 * Open to read. Writing needs the volunteers' password — a second sign-in that
 * opens this page and nothing else — so each person writes their own two
 * sentences instead of the committee writing forty of them from memory.
 */
export default function VolunteersPage() {
  const session = useCommitteeSession();
  // Either sign-in writes here. Add, edit and remove all travel together: a
  // volunteer who listed themselves twice shouldn't have to find a committee
  // member to undo it.
  const canWrite = session.role !== null;

  const [people, setPeople] = useState<Volunteer[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Volunteer | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/volunteers");
    if (!res.ok) return setPeople([]);
    const d = await res.json();
    setPeople(d.volunteers ?? []);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  // Groups in the order their first member was added, so the page doesn't
  // reshuffle itself every time somebody new signs up.
  const groups = useMemo(() => {
    const by = new Map<string, Volunteer[]>();
    for (const v of people ?? []) {
      const key = v.role.trim() || "Helped out";
      const bucket = by.get(key);
      if (bucket) bucket.push(v);
      else by.set(key, [v]);
    }
    return [...by.entries()];
  }, [people]);

  if (!people) return null;

  return (
    <div>
      <PageHeader
        title="With thanks"
        subtitle="The festival was run by these people. It does not happen without them."
        actions={
          canWrite ? (
            <Button size="sm" onClick={() => setAdding(true)}>
              Add your name
            </Button>
          ) : null
        }
      />

      {/* The evening itself, above the people who made it happen. */}
      <FestivalCollage canEdit={canWrite} />

      {people.length ? (
        <div className="space-y-7">
          {groups.map(([role, members]) => (
            <section key={role}>
              <div className="mb-2.5 flex items-baseline justify-between gap-3 border-b border-line pb-1.5">
                <SectionTitle>{role}</SectionTitle>
                <span className="tnum shrink-0 text-[0.6875rem] text-ink-faint">
                  {members.length === 1 ? "1 person" : `${members.length} people`}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {members.map((v) => (
                  <Card key={v.id} className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Optional, and a missing one must not read as a fault:
                          plenty of people will not want their face on a page
                          the whole society can open. Their initial stands in. */}
                      <Face name={v.name} url={v.photoUrl} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="min-w-0 text-[0.9375rem] font-semibold text-ink">
                            {v.name}
                          </p>
                          {v.flat ? (
                            <span className="tnum shrink-0 text-xs text-ink-faint">{v.flat}</span>
                          ) : null}
                        </div>
                        {v.note ? (
                          <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-soft">
                            {v.note}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {canWrite ? (
                      <p className="mt-3 flex gap-3">
                        <button
                          type="button"
                          onClick={() => setEditing(v)}
                          className="text-[0.6875rem] font-medium text-brand underline decoration-brand/30 underline-offset-2"
                        >
                          Edit
                        </button>
                        <RemoveVolunteer id={v.id} name={v.name} onDone={load} />
                      </p>
                    ) : null}
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nobody credited yet"
          description={
            canWrite
              ? "Add your name, what you helped with, and a line about how."
              : "Were you part of it? Sign in as a volunteer and add yourself."
          }
          action={canWrite ? <Button onClick={() => setAdding(true)}>Add your name</Button> : undefined}
        />
      )}

      {canWrite ? (
        /* A shared password on a shared phone: whoever is holding it next
           should not inherit the last person's session. The nav's sign-out is
           for the committee, and a volunteer never sees the nav. */
        <p className="mt-8 text-center text-xs text-ink-faint">
          Signed in as {session.role === "committee" ? "the committee" : "a volunteer"} ·{" "}
          <SignOut />
        </p>
      ) : (
        <p className="mt-8 text-center text-xs text-ink-faint">
          Helped with the festival?{" "}
          <a
            href="/generator-login?next=%2Fvolunteers"
            className="font-medium text-brand underline decoration-brand/30 underline-offset-2"
          >
            Sign in as a volunteer
          </a>{" "}
          to add your name.
        </p>
      )}

      {adding ? (
        <VolunteerSheet
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            void load();
          }}
        />
      ) : null}
      {editing ? (
        <VolunteerSheet
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Sign out, and reload rather than re-render.
 *
 * The cookie is httpOnly and the session state was read once on mount, so
 * clearing it without a reload leaves the page still showing edit buttons that
 * the server will now refuse. A full navigation is the honest version.
 */
function SignOut() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/generator-login", { method: "DELETE" });
        window.location.href = "/volunteers";
      }}
      className="font-medium text-brand underline decoration-brand/30 underline-offset-2 disabled:opacity-50"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}

/**
 * A volunteer's picture, or the letter their name starts with.
 *
 * The fallback is not a placeholder-person icon. Forty identical grey
 * silhouettes read as forty missing photographs; forty initials read as a list
 * of people. A photo here is optional and should stay comfortable to skip.
 */
function Face({ name, url, size = 44 }: { name: string; url?: string; size?: number }) {
  if (url) {
    return (
      <span
        className="relative block shrink-0 overflow-hidden rounded-full bg-surface-sunken ring-1 ring-line"
        style={{ width: size, height: size }}
      >
        <Image src={url} alt="" fill sizes={`${size}px`} className="object-cover" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full bg-brand-soft font-semibold text-brand-ink"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function RemoveVolunteer({
  id,
  name,
  onDone,
}: {
  id: string;
  name: string;
  onDone: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm(`Remove ${name} from the thanks?`)) return;
        setBusy(true);
        const res = await fetch(`/api/volunteers?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        setBusy(false);
        if (!res.ok) return toast("Could not remove them.", "error");
        toast(`${name} removed.`);
        onDone();
      }}
      className="text-[0.6875rem] font-medium text-debit underline decoration-debit/30 underline-offset-2 disabled:opacity-50"
    >
      {busy ? "…" : "Remove"}
    </button>
  );
}

/**
 * Suggestions rather than a fixed list: the festival threw up jobs nobody
 * planned for, and a dropdown would have made those people pick the nearest
 * wrong answer. Typing a new one starts a new section.
 */
const TEAMS = [
  "Food counter",
  "Decoration",
  "Sound and stage",
  "Rituals and puja",
  "Collections",
  "Dahi handi",
  "Setup and cleanup",
];

function VolunteerSheet({
  onClose,
  onSaved,
  existing,
}: {
  onClose: () => void;
  onSaved: () => void;
  existing?: Volunteer;
}) {
  const toast = useToast();
  const [name, setName] = useState(existing?.name ?? "");
  const [flat, setFlat] = useState(existing?.flat ?? "");
  const [role, setRole] = useState(existing?.role ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [photoUrl, setPhotoUrl] = useState(existing?.photoUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  /**
   * Uploaded as soon as it is chosen, and saved onto the row only when the
   * form is. A picture that appears in the sheet but is still sitting in the
   * browser when Save is pressed is a picture the page never gets.
   */
  async function choose(file: File) {
    setError(null);
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/volunteers/photo", { method: "POST", body: form });
    const payload = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    setUploading(false);
    if (!res.ok || !payload.url) return setError(payload.error ?? "That photo didn't upload.");
    setPhotoUrl(payload.url);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/volunteers", {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(existing ? { id: existing.id } : {}),
        name,
        flat,
        role,
        note,
        photoUrl,
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(payload.error ?? "Could not save it.");
      setBusy(false);
      return;
    }
    toast(existing ? `${name} updated.` : `${name} added to the thanks.`);
    onSaved();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={existing ? "Edit" : "Add your name"}
      description="Shown to every resident. No phone numbers — this is a thank-you, not a contact list."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : existing ? "Save" : "Add"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3.5">
        <div className="flex items-center gap-3.5">
          <Face name={name || "?"} url={photoUrl} size={56} />
          <div className="min-w-0">
            <input
              ref={picker}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void choose(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => picker.current?.click()}
              className="text-[0.8125rem] font-medium text-brand underline decoration-brand/30 underline-offset-2 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : photoUrl ? "Change photo" : "Add your photo"}
            </button>
            {photoUrl ? (
              <button
                type="button"
                onClick={() => setPhotoUrl("")}
                className="ml-3 text-[0.8125rem] font-medium text-ink-faint underline decoration-line underline-offset-2"
              >
                Remove
              </button>
            ) : (
              <p className="mt-0.5 text-[0.6875rem] text-ink-faint">
                Optional — so people can put a face to the name.
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label="Name" required>
              <input
                className="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={60}
                placeholder="e.g. Anup Deo"
              />
            </Field>
          </div>
          <Field label="Flat" hint="Optional.">
            <input
              className="field tnum"
              value={flat}
              onChange={(e) => setFlat(e.target.value)}
              maxLength={8}
              placeholder="N-130"
            />
          </Field>
        </div>

        <Field label="What you helped with" required hint="This becomes the heading you appear under.">
          <input
            className="field"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
            maxLength={60}
            list="volunteer-teams"
            placeholder="e.g. Food counter"
          />
          <datalist id="volunteer-teams">
            {TEAMS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>

        <Field label="How you helped" hint="A line or two, in your own words. This is the part people read.">
          <textarea
            className="field resize-y"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={400}
            placeholder="e.g. Served at the counter both evenings and stayed back to clear up after the handi."
          />
        </Field>

        {error ? (
          <p role="alert" className="rounded-lg bg-debit-soft px-3 py-2.5 text-[0.8125rem] text-debit">
            {error}
          </p>
        ) : null}
      </form>
    </Sheet>
  );
}
