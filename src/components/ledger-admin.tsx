"use client";

import { useEffect, useState } from "react";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "@/lib/types";
import { humanise, methodLabel, toDateInput } from "@/lib/format";
import { useSociety } from "@/lib/store";
import { Button, Field, Sheet, useToast } from "./ui";
import type { Donation, Expense } from "@/lib/types";

/**
 * Whether this browser holds a committee session.
 *
 * The cookie is httpOnly so the page can't read it; it asks the server once.
 * This only decides whether to render the controls — the server checks again
 * on every write, because hiding a button is not a permission.
 */
export function useCommitteeSession(): { authenticated: boolean; checked: boolean } {
  const [state, setState] = useState({ authenticated: false, checked: false });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/session")
      .then((r) => r.json())
      .then((d: { authenticated?: boolean }) => {
        if (!cancelled) setState({ authenticated: !!d.authenticated, checked: true });
      })
      .catch(() => {
        if (!cancelled) setState({ authenticated: false, checked: true });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/**
 * Sign-in prompt for a committee member who came to add something.
 *
 * Takes where to return to, because it sent everyone to the ledger — so
 * signing in from the donations list landed you on a different page than the
 * one you were trying to add to.
 *
 * It used to say "with the same password as the receipt generator", which only
 * means anything to someone who already knows there is a receipt generator and
 * that it has a password. To everyone else it was a puzzle in front of a door.
 */
export function CommitteeSignInHint({ next = "/ledger" }: { next?: string }) {
  return (
    <a
      href={`/generator-login?next=${encodeURIComponent(next)}`}
      className="text-xs font-medium text-brand underline decoration-brand/30 underline-offset-2"
    >
      Admin sign in
    </a>
  );
}

export function AddExpenseButton({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Add expense
      </Button>
      {open ? (
        <ExpenseSheet
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            onSaved();
          }}
        />
      ) : null}
    </>
  );
}

/**
 * Correcting an entry, for the committee.
 *
 * The same sheet as recording one. An amount typed wrong, or a bill that only
 * arrived a week later, should not need the row deleted and retyped — that
 * loses the date it was recorded and every reference to it. The correction
 * stamps the row instead, and the ledger shows the stamp.
 */
export function ExpenseSheet({
  onClose,
  onSaved,
  existing,
}: {
  onClose: () => void;
  onSaved: () => void;
  existing?: Expense;
}) {
  const { data } = useSociety();
  const toast = useToast();

  const [title, setTitle] = useState(existing?.title ?? "");
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [category, setCategory] = useState<string>(existing?.category ?? "miscellaneous");
  const [vendor, setVendor] = useState(existing?.vendor ?? "");
  const [billNo, setBillNo] = useState(existing?.billNo ?? "");
  const [paidBy, setPaidBy] = useState(existing?.paidBy ?? "");
  const [method, setMethod] = useState<string>(existing?.method ?? "upi");
  const [paidAt, setPaidAt] = useState(
    toDateInput(existing?.paidAt ?? new Date().toISOString()),
  );
  const [activityId, setActivityId] = useState(existing?.activityId ?? "");
  const [file, setFile] = useState<File | null>(null);
  // Kept once uploaded, so retrying a failed save doesn't upload it twice.
  const [billPath, setBillPath] = useState<string | null>(null);
  // Only meaningful when editing something that already has one.
  const [dropBill, setDropBill] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const keptBill = Boolean(existing?.hasBill) && !dropBill && !file;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // The file goes up first: if it fails there is no half-recorded entry
      // claiming a bill that was never stored.
      let path = billPath;
      if (file && !path) {
        const form = new FormData();
        form.append("file", file);
        const up = await fetch("/api/expenses/attachment", { method: "POST", body: form });
        const upPayload = (await up.json().catch(() => ({}))) as {
          path?: string;
          error?: string;
        };
        if (!up.ok || !upPayload.path) {
          setError(upPayload.error ?? "Could not attach that file.");
          setBusy(false);
          return;
        }
        path = upPayload.path;
        setBillPath(path);
      }

      // On an edit, billPath is sent only when it actually changed: absent
      // means "leave the attachment alone", null means "remove it".
      const attachment =
        path !== null ? { billPath: path } : dropBill ? { billPath: null } : {};

      const res = await fetch("/api/expenses", {
        method: existing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(existing ? { id: existing.id } : {}),
          title,
          amount: Number(amount),
          category,
          vendor,
          billNo,
          paidBy,
          method,
          paidAt,
          activityId: activityId || null,
          ...(existing ? attachment : { billPath: path }),
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(payload.error ?? "Could not save the entry.");
        setBusy(false);
        return;
      }
      toast(existing ? "Entry corrected." : "Expense recorded.");
      onSaved();
    } catch {
      setError("Couldn't reach the server. Check your connection.");
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={existing ? "Correct this entry" : "Record an expense"}
      description={
        existing
          ? "The ledger will show that this entry was edited, so residents reading it know it changed."
          : "Everyone can see this entry — the vendor, bill number and who paid. The attached photo stays with the committee."
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : existing ? "Save correction" : "Record expense"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="What was it for" required>
          <input
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g. Dahi handi rigging and matki set"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount ₹" required>
            <input
              className="field tnum"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              required
              placeholder="8500"
            />
          </Field>
          <Field label="Date paid" required>
            <input
              className="field"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              required
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select
              className="field"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {humanise(c)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="How it was paid">
            <select className="field" value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {methodLabel(m)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Vendor" hint="Who was paid.">
            <input className="field" value={vendor} onChange={(e) => setVendor(e.target.value)} />
          </Field>
          <Field label="Bill no." hint="So anyone can ask to see the paper.">
            <input className="field" value={billNo} onChange={(e) => setBillNo(e.target.value)} />
          </Field>
        </div>

        <Field label="Paid by" hint="Who handed the money over — the person to reimburse.">
          <input
            className="field"
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
            placeholder="e.g. Sidhesh Kumar"
          />
        </Field>

        <Field
          label="Bill or payment screenshot"
          hint="Committee only. Residents see that proof is on file, not the image."
        >
          {keptBill ? (
            <div className="flex items-center gap-3 rounded-[10px] bg-surface-sunken px-3 py-2.5">
              <span className="flex-1 text-[0.8125rem] text-ink">Already on file</span>
              <button
                type="button"
                onClick={() => setDropBill(true)}
                className="text-[0.6875rem] font-medium text-debit underline decoration-debit/30 underline-offset-2"
              >
                Remove
              </button>
            </div>
          ) : (
            <input
              className="field"
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                // A different file means the old upload no longer applies.
                setBillPath(null);
                setDropBill(false);
              }}
            />
          )}
          {existing?.hasBill && dropBill && !file ? (
            <p className="mt-1.5 text-[0.6875rem] text-debit">
              The attached file will be deleted when you save.{" "}
              <button
                type="button"
                onClick={() => setDropBill(false)}
                className="font-medium underline decoration-debit/30 underline-offset-2"
              >
                Keep it
              </button>
            </p>
          ) : null}
        </Field>

        <Field label="For which activity">
          <select
            className="field"
            value={activityId}
            onChange={(e) => setActivityId(e.target.value)}
          >
            <option value="">General society spending</option>
            {data.activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
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

/**
 * Removes a contribution. Committee only, and the server checks again.
 *
 * Says what it takes to keep it removed. A row from a statement comes straight
 * back on the next import unless its reference is written into
 * scripts/excluded-transactions.txt, and nobody would guess that from a
 * "Removed." toast.
 */
export function DeleteDonationButton({ id, onDone }: { id: string; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm("Remove this contribution from the register?")) return;
        setBusy(true);
        const res = await fetch(`/api/donations?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
          receiptNo?: string;
          reference?: string | null;
        };
        setBusy(false);
        if (!res.ok) {
          toast(payload.error ?? "Could not remove it.", "error");
          return;
        }
        toast(
          payload.reference
            ? `${payload.receiptNo} removed. Add ${payload.reference} to excluded-transactions.txt or the next import restores it.`
            : `${payload.receiptNo} removed.`,
        );
        onDone();
      }}
      className="text-[0.6875rem] font-medium text-debit underline decoration-debit/30 underline-offset-2 disabled:opacity-50"
    >
      {busy ? "…" : "Remove"}
    </button>
  );
}

/** Removes an entry. Committee only, and the server checks again. */
export function DeleteExpenseButton({ id, onDone }: { id: string; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm("Remove this entry from the ledger?")) return;
        setBusy(true);
        const res = await fetch(`/api/expenses?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setBusy(false);
        if (!res.ok) {
          toast(payload.error ?? "Could not remove it.", "error");
          return;
        }
        toast("Entry removed.");
        onDone();
      }}
      className="text-[0.6875rem] font-medium text-debit underline decoration-debit/30 underline-offset-2 disabled:opacity-50"
    >
      {busy ? "…" : "Remove"}
    </button>
  );
}

/* ------------------------------------------------- recording cash by hand */

/**
 * Records a contribution that never touches the bank — cash at a door.
 *
 * Money paid by UPI or transfer should arrive through the daily statement
 * import instead, so it is reconciled against the account rather than typed
 * twice. Cash is the case the statement can never see.
 */
export function AddDonationButton({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Add donation
      </Button>
      {open ? (
        <DonationSheet
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            onSaved();
          }}
        />
      ) : null}
    </>
  );
}

export function DonationSheet({
  onClose,
  onSaved,
  existing,
}: {
  onClose: () => void;
  onSaved: () => void;
  existing?: Donation;
}) {
  const { data } = useSociety();
  const toast = useToast();

  /*
   * Everything is editable, on the committee's instruction — including the
   * amount, date and reference of a row that came off a statement. They
   * answer for the figures, and a field they cannot change here only moves
   * the correction into the database, where nothing records it.
   */
  const [donorName, setDonorName] = useState(
    existing && !/^Anonymous\b/.test(existing.donorName) ? existing.donorName : "",
  );
  const [wing, setWing] = useState(existing?.wing ?? "");
  const [flat, setFlat] = useState(existing?.flat ?? "");
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [reference, setReference] = useState(existing?.reference ?? "");
  const [method, setMethod] = useState<string>(existing?.method ?? "cash");
  const [receivedAt, setReceivedAt] = useState(
    toDateInput(existing?.receivedAt ?? new Date().toISOString()),
  );
  const [activityId, setActivityId] = useState(
    existing?.activityId ?? data.activities[0]?.id ?? "",
  );
  const [isTenant, setIsTenant] = useState(existing?.isTenant ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/donations", {
        method: existing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          existing
            ? {
                id: existing.id, donorName, wing, flat, isTenant,
                amount: Number(amount), method, reference, receivedAt,
              }
            : {
                donorName, wing, flat, amount: Number(amount), method, reference,
                receivedAt, activityId: activityId || null, isTenant,
              },
        ),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(payload.error ?? "Could not save the entry.");
        setBusy(false);
        return;
      }
      toast(existing ? `${donorName} updated.` : `${donorName} recorded.`);
      onSaved();
    } catch {
      setError("Couldn't reach the server. Check your connection.");
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={existing ? "Correct this contribution" : "Record a contribution"}
      description={
        existing
          ? "Every field can be corrected. If this came from a statement, changing the amount or date means the register no longer agrees with it."
          : "For money handed over in person, or a payment the statement import will not pick up. Give the transaction ID where there is one."
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : existing ? "Save changes" : "Record"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Contributor's name" required>
          <input
            className="field"
            value={donorName}
            onChange={(e) => setDonorName(e.target.value)}
            required
            placeholder="e.g. Anup Deo"
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Tower">
            {data.society.wings.length ? (
              <select className="field" value={wing} onChange={(e) => setWing(e.target.value)}>
                <option value="">—</option>
                {data.society.wings.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            ) : (
              <input className="field" value={wing} onChange={(e) => setWing(e.target.value)} />
            )}
          </Field>
          <Field label="Flat">
            <input
              className="field tnum"
              value={flat}
              onChange={(e) => setFlat(e.target.value)}
              inputMode="numeric"
            />
          </Field>
          <Field label="Amount ₹" required>
            <input
              className="field tnum"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              required
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Paid by">
            <select className="field" value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{methodLabel(m)}</option>
              ))}
            </select>
          </Field>
          <Field label="Date received" required>
            <input
              className="field"
              type="date"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
              required
            />
          </Field>
        </div>

        {/* Every other contribution carries one, and it is what the receipt
            prints and what a donor recognises their own payment by. Blank for
            cash, which genuinely has no reference — that is the only case. */}
        <Field
          label="Transaction ID / UTR"
          hint={
            method === "cash"
              ? "Cash has none — leave it blank."
              : "From the payment. It goes on the receipt and prevents a double entry."
          }
        >
          <input
            className="field"
            value={reference}
            onChange={(e) => setReference(e.target.value.trim())}
            placeholder={method === "cash" ? "—" : "e.g. 128286391110"}
          />
        </Field>

        <Field label="For which activity">
          <select
            className="field"
            value={activityId}
            onChange={(e) => setActivityId(e.target.value)}
          >
            <option value="">General society fund</option>
            {data.activities.map((a) => (
              <option key={a.id} value={a.id}>{a.title}</option>
            ))}
          </select>
        </Field>

        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-surface-sunken px-3 py-2.5">
          <input
            type="checkbox"
            checked={isTenant}
            onChange={(e) => setIsTenant(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-brand)]"
          />
          <span className="text-[0.8125rem] text-ink">Paying resident is a tenant</span>
        </label>

        {method !== "cash" ? (
          <p className="rounded-lg bg-warn-soft px-3 py-2.5 text-xs leading-relaxed text-warn">
            This will also appear in tonight&apos;s statement import. The importer skips a match
            on name, amount and date — but if any of those differ you will get two entries for
            one contribution.
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-lg bg-debit-soft px-3 py-2.5 text-[0.8125rem] text-debit">
            {error}
          </p>
        ) : null}
      </form>
    </Sheet>
  );
}
