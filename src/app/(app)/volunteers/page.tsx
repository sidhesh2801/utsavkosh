"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, EmptyState, Field, PageHeader, Sheet, useToast } from "@/components/ui";
import { useCommitteeSession } from "@/components/ledger-admin";

interface Volunteer {
  id: string;
  name: string;
  flat: string;
  role: string;
  note: string;
}

/**
 * The people who ran the festival.
 *
 * The app has recorded every rupee since August and, until now, none of the
 * people who carried the chairs or stood at the food counter for two days. A
 * society that publishes its money and not its volunteers has said something
 * about what it counts.
 *
 * Open to read and committee-only to add, for the same reason the donations
 * list is: a credits page anyone could add themselves to would stop meaning
 * anything by the end of the week.
 */
export default function VolunteersPage() {
  const committee = useCommitteeSession();
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

  if (!people) return null;

  return (
    <div>
      <PageHeader
        title="With thanks"
        subtitle="The festival was run by these people. It does not happen without them."
        actions={
          committee.authenticated ? (
            <Button size="sm" onClick={() => setAdding(true)}>
              Add someone
            </Button>
          ) : null
        }
      />

      {people.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {people.map((v) => (
            <Card key={v.id} className="p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 text-[0.9375rem] font-semibold text-ink">{v.name}</p>
                {v.flat ? (
                  <span className="tnum shrink-0 text-xs text-ink-faint">{v.flat}</span>
                ) : null}
              </div>
              <p className="mt-1 inline-flex rounded-full bg-brand-soft px-2.5 py-0.5 text-[0.6875rem] font-medium text-brand-ink">
                {v.role}
              </p>
              {v.note ? (
                <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-soft">{v.note}</p>
              ) : null}
              {committee.authenticated ? (
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
      ) : (
        <EmptyState
          title="Nobody credited yet"
          description={
            committee.authenticated
              ? "Add the people who helped — what they did, and a line about how."
              : "The committee hasn't added the volunteers yet."
          }
          action={
            committee.authenticated ? (
              <Button onClick={() => setAdding(true)}>Add someone</Button>
            ) : undefined
          }
        />
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/volunteers", {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(existing ? { id: existing.id } : {}), name, flat, role, note }),
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
      title={existing ? "Edit" : "Add someone"}
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
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label="Name" required>
              <input
                className="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Anup Deo"
              />
            </Field>
          </div>
          <Field label="Flat" hint="Optional.">
            <input
              className="field tnum"
              value={flat}
              onChange={(e) => setFlat(e.target.value)}
              placeholder="N-130"
            />
          </Field>
        </div>

        <Field label="What they helped with" required hint="A few words.">
          <input
            className="field"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
            placeholder="e.g. Food counter"
          />
        </Field>

        <Field label="How they helped" hint="A sentence. This is the part people read.">
          <textarea
            className="field resize-y"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Served at the counter both evenings and stayed back to clear up."
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
