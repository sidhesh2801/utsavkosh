"use client";

import { useEffect, useState } from "react";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "@/lib/types";
import { humanise, methodLabel, toDateInput } from "@/lib/format";
import { useSociety } from "@/lib/store";
import { Button, Field, Sheet, useToast } from "./ui";

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

/** Sign-in prompt for residents who land on the ledger wanting to add to it. */
export function CommitteeSignInHint() {
  return (
    <p className="text-xs leading-relaxed text-ink-faint">
      Adding to the ledger is for the committee.{" "}
      <a
        href="/generator-login?next=/ledger"
        className="text-brand underline decoration-brand/30 underline-offset-2"
      >
        Sign in
      </a>{" "}
      with the same password as the receipt generator.
    </p>
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

function ExpenseSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data } = useSociety();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("miscellaneous");
  const [vendor, setVendor] = useState("");
  const [billNo, setBillNo] = useState("");
  const [method, setMethod] = useState<string>("upi");
  const [paidAt, setPaidAt] = useState(toDateInput(new Date().toISOString()));
  const [activityId, setActivityId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          amount: Number(amount),
          category,
          vendor,
          billNo,
          method,
          paidAt,
          activityId: activityId || null,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(payload.error ?? "Could not save the entry.");
        setBusy(false);
        return;
      }
      toast("Expense recorded.");
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
      title="Record an expense"
      description="Everyone can see this entry, including the vendor and bill number."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Record expense"}
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
          <Field label="Paid by">
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
