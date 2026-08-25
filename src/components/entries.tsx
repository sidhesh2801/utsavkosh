"use client";

import { useMemo, useState } from "react";
import {
  ACTIVITY_CATEGORIES,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  type Activity,
  type Donation,
  type Expense,
} from "@/lib/types";
import {
  flatLabel,
  humanise,
  methodLabel,
  money,
  shortDate,
  toDateInput,
  toDateTimeInput,
} from "@/lib/format";
import { useLookups, useSociety, type NewActivity, type NewDonation, type NewExpense } from "@/lib/store";
import { AmountChips, Avatar, Badge, Button, Field, MoneyInput, Sheet, useToast } from "./ui";
import { ReceiptActions, ReceiptButton } from "./receipt";
import { ProofCapture } from "./proof";
import { ShowQrSheet } from "./payment-qr";

/** The amounts residents actually give — saves typing at a doorstep. */
const QUICK_AMOUNTS = [1100, 2100, 3100, 5100, 7500, 11000];

const today = () => toDateInput(new Date().toISOString());

/* ---------------------------------------------------------------- donations */

export function DonationForm({
  open,
  onClose,
  /** Pre-selects the drive being collected for. */
  defaultActivityId,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  defaultActivityId?: string | null;
  existing?: Donation;
}) {
  const { data, addDonation, updateDonation, session, isAdmin } = useSociety();
  const toast = useToast();

  const [donorName, setDonorName] = useState(existing?.donorName ?? "");
  const [wing, setWing] = useState(existing?.wing ?? "");
  const [flat, setFlat] = useState(existing?.flat ?? "");
  const [amount, setAmount] = useState<number | "">(existing?.amount ?? "");
  const [method, setMethod] = useState<Donation["method"]>(existing?.method ?? "cash");
  const [reference, setReference] = useState(existing?.reference ?? "");
  const [activityId, setActivityId] = useState<string>(
    existing?.activityId ?? defaultActivityId ?? "",
  );
  const [receivedAt, setReceivedAt] = useState(
    existing ? toDateInput(existing.receivedAt) : today(),
  );
  const [note, setNote] = useState(existing?.note ?? "");
  const [donorMobile, setDonorMobile] = useState(existing?.donorMobile ?? "");
  const [isTenant, setIsTenant] = useState(existing?.isTenant ?? false);
  const [showingQr, setShowingQr] = useState(false);
  /** Set once saved, switching the sheet to the proof-and-receipt step. */
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const openDrives = useMemo(
    () => data.activities.filter((a) => a.status !== "cancelled"),
    [data.activities],
  );

  /** The registered owner of the currently selected flat, if we know them. */
  const registeredOwner = useMemo(() => {
    if (!wing || !flat) return null;
    return (
      data.members.find(
        (m) => m.wing.toUpperCase() === wing.toUpperCase() && m.flat === flat,
      ) ?? null
    );
  }, [data.members, wing, flat]);

  /**
   * Typing a flat fills in the resident's name and mobile, so entries stay
   * consistent and the receipt can go out without asking for the number.
   *
   * Skipped for tenants — the register holds the owner, who isn't the person
   * paying, and overwriting the tenant's name would put the wrong name on
   * their receipt.
   */
  function fillFromFlat(nextWing: string, nextFlat: string) {
    if (isTenant || !nextWing || !nextFlat) return;
    const match = data.members.find(
      (m) => m.wing.toUpperCase() === nextWing.toUpperCase() && m.flat === nextFlat,
    );
    if (!match) return;
    if (!donorName.trim()) setDonorName(match.name);
    if (!donorMobile.trim()) setDonorMobile(match.mobile);
  }

  /** Switching to tenant clears the owner's details so they aren't sent a receipt. */
  function toggleTenant(next: boolean) {
    setIsTenant(next);
    if (next) {
      if (registeredOwner && donorName === registeredOwner.name) setDonorName("");
      if (registeredOwner && donorMobile === registeredOwner.mobile) setDonorMobile("");
    } else {
      fillFromFlat(wing, flat);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (amount === "" || amount <= 0) {
      setError("Please enter the amount received.");
      return;
    }
    setBusy(true);
    const payload: NewDonation = {
      donorName,
      wing: wing || undefined,
      flat: flat || undefined,
      amount,
      method,
      reference: reference.trim() || undefined,
      activityId: activityId || null,
      receivedAt,
      note: note.trim() || undefined,
      donorMobile: donorMobile.trim() || undefined,
      isTenant: isTenant || undefined,
    };
    const result = existing
      ? await updateDonation(existing.id, payload)
      : await addDonation(payload);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (existing) {
      toast("Entry updated.");
      onClose();
      return;
    }
    toast(
      isAdmin
        ? `${money(amount)} recorded.`
        : `${money(amount)} recorded — the treasurer will confirm it at handover.`,
    );
    // Stay in the flow: the volunteer is still at the door, so the proof photo
    // and the receipt should go out now rather than being chased up later.
    setSavedId(result.value as string);
  }

  const saved = savedId ? data.donations.find((d) => d.id === savedId) : null;

  // Step two: money is recorded, now attach the proof and send the receipt.
  if (saved) {
    return (
      <Sheet
        open={open}
        onClose={onClose}
        title="Recorded — now send the receipt"
        description={`Receipt ${saved.receiptNo} · ${money(saved.amount)} from ${saved.donorName}`}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Done
            </Button>
            <Button
              onClick={() => {
                // Reset for the next door without closing the sheet.
                setSavedId(null);
                setAmount("");
                setDonorName("");
                setDonorMobile("");
                setIsTenant(false);
                setWing("");
                setFlat("");
                setReference("");
                setNote("");
              }}
            >
              Next flat
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-line px-3.5 py-3">
            <p className="text-[0.8125rem] font-medium text-ink">
              1. Capture proof
              {saved.proofSrc ? <span className="ml-1.5 text-credit">✓</span> : null}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
              {saved.method === "cash"
                ? "Photograph the paper receipt stub you've written."
                : "Photograph their “payment successful” screen."}
            </p>
            <ProofCapture donation={saved} />
          </div>

          <div className="rounded-xl border border-line px-3.5 py-3">
            <p className="text-[0.8125rem] font-medium text-ink">
              2. Send it to them
              {saved.receiptSentAt ? <span className="ml-1.5 text-credit">✓</span> : null}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
              {saved.donorMobile
                ? `WhatsApp opens on ${saved.donorMobile} with the receipt ready.`
                : "Add their number to send it directly."}
            </p>
            <div className="mt-2.5">
              <ReceiptActions donation={saved} />
            </div>
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={existing ? "Edit contribution" : "Record a contribution"}
      description={
        existing
          ? undefined
          : isAdmin
            ? "Recorded as verified, since you're holding the society's money."
            : "This will show as awaiting handover until the treasurer confirms it."
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : existing ? "Save changes" : "Record contribution"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Amount received" required>
          <MoneyInput value={amount} onChange={setAmount} autoFocus={!existing} />
          <div className="mt-2">
            <AmountChips amounts={QUICK_AMOUNTS} onPick={setAmount} active={amount} />
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Wing">
            {data.society.wings.length ? (
              <select
                className="field"
                value={wing}
                onChange={(e) => {
                  setWing(e.target.value);
                  fillFromFlat(e.target.value, flat);
                }}
              >
                <option value="">—</option>
                {data.society.wings.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            ) : (
              <input className="field" value={wing} onChange={(e) => setWing(e.target.value)} />
            )}
          </Field>
          <Field label="Flat number">
            <input
              className="field tnum"
              value={flat}
              inputMode="numeric"
              onChange={(e) => {
                setFlat(e.target.value);
                fillFromFlat(wing, e.target.value);
              }}
              placeholder="305"
            />
          </Field>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-surface-sunken px-3 py-2.5">
          <input
            type="checkbox"
            checked={isTenant}
            onChange={(e) => toggleTenant(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand)]"
          />
          <span className="min-w-0">
            <span className="block text-[0.8125rem] font-medium text-ink">
              Paying resident is a tenant
            </span>
            <span className="mt-0.5 block text-xs leading-snug text-ink-soft">
              {registeredOwner
                ? `The flat is registered to ${registeredOwner.name}. Tick this to put the tenant's own name on the receipt instead.`
                : "Tick this if the person paying isn't the registered owner."}
            </span>
          </span>
        </label>

        <Field
          label={isTenant ? "Tenant's name" : "Contributor's name"}
          hint={
            isTenant
              ? "This is the name that goes on the receipt."
              : "Fills in automatically when the flat is on our resident list."
          }
          required
        >
          <input
            className="field"
            value={donorName}
            onChange={(e) => setDonorName(e.target.value)}
            required
            placeholder={isTenant ? "e.g. Ramesh Gupta (tenant)" : "e.g. Sunil Kulkarni"}
          />
        </Field>

        <Field
          label="WhatsApp number"
          hint="Optional — used to send the receipt straight to them."
        >
          <input
            className="field tnum"
            type="tel"
            inputMode="numeric"
            value={donorMobile}
            onChange={(e) => setDonorMobile(e.target.value)}
            placeholder="98200 11234"
          />
        </Field>

        <Field label="For which activity">
          <select
            className="field"
            value={activityId}
            onChange={(e) => setActivityId(e.target.value)}
          >
            <option value="">General society fund</option>
            {openDrives.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Paid by" required>
            <select
              className="field"
              value={method}
              onChange={(e) => setMethod(e.target.value as Donation["method"])}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {methodLabel(m)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date received" required>
            <input
              className="field"
              type="date"
              value={receivedAt}
              max={today()}
              onChange={(e) => setReceivedAt(e.target.value)}
              required
            />
          </Field>
        </div>

        {/* The doorstep step: show the society's QR for them to scan. */}
        {method === "upi" ? (
          <div className="rounded-xl border border-brand/20 bg-brand-soft/50 px-3.5 py-3">
            <p className="text-[0.8125rem] font-medium text-brand-ink">
              Let them scan the society&apos;s QR
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
              Show the code, then capture their payment confirmation as proof after saving.
            </p>
            <Button size="sm" className="mt-2.5" onClick={() => setShowingQr(true)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
              Show QR to scan
            </Button>
          </div>
        ) : null}

        {method !== "cash" ? (
          <Field
            label="Reference number"
            hint="UPI transaction id, NEFT reference or cheque number — the proof for the ledger."
          >
            <input
              className="field"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="UPI/425708823456"
            />
          </Field>
        ) : null}

        <Field label="Note" hint="Optional — anything worth remembering about this entry.">
          <textarea
            className="field resize-y"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>

        {error ? (
          <p role="alert" className="rounded-lg bg-debit-soft px-3 py-2 text-[0.8125rem] text-debit">
            {error}
          </p>
        ) : null}

        {session && !isAdmin ? (
          <p className="rounded-lg bg-warn-soft px-3 py-2.5 text-xs leading-relaxed text-warn">
            You&apos;re recording as a volunteer. Hand the cash to the treasurer and
            they&apos;ll mark it verified — only then does it count towards the society balance.
          </p>
        ) : null}
      </form>

      {showingQr ? (
        <ShowQrSheet
          amount={amount === "" ? undefined : amount}
          activityId={activityId || null}
          onClose={() => setShowingQr(false)}
        />
      ) : null}
    </Sheet>
  );
}

export function DonationRow({
  donation,
  showActivity = true,
  onEdit,
}: {
  donation: Donation;
  showActivity?: boolean;
  onEdit?: () => void;
}) {
  const { activityById, memberById } = useLookups();
  const { isAdmin, verifyDonation, session } = useSociety();
  const toast = useToast();
  const activity = donation.activityId ? activityById.get(donation.activityId) : null;
  const recorder = memberById.get(donation.recordedBy);
  const isPending = donation.status === "pending";
  const mine = donation.recordedBy === session?.id;

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Avatar name={donation.donorName} tone={isPending ? "neutral" : "brand"} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-sm font-medium text-ink">{donation.donorName}</p>
          <p className="tnum shrink-0 text-sm font-semibold text-ink">{money(donation.amount)}</p>
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-soft">
          {donation.wing || donation.flat ? (
            <span className="tnum">{flatLabel(donation.wing, donation.flat)}</span>
          ) : null}
          {donation.isTenant ? <span className="text-ink-faint">tenant</span> : null}
          <span>{methodLabel(donation.method)}</span>
          <span className="tnum">{shortDate(donation.receivedAt)}</span>
        </p>
        {donation.reference ? (
          <p className="tnum mt-0.5 truncate text-[0.6875rem] text-ink-faint">
            {donation.reference}
          </p>
        ) : null}
        {showActivity ? (
          <p className="mt-1 truncate text-xs text-ink-faint">
            {activity ? activity.title : "General society fund"}
          </p>
        ) : null}
        {donation.note ? (
          <p className="mt-1 text-xs italic leading-snug text-ink-soft">{donation.note}</p>
        ) : null}

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {isPending ? (
            <Badge tone="warn">Awaiting handover</Badge>
          ) : (
            <Badge tone="credit">Verified</Badge>
          )}
          {recorder ? (
            <span className="text-[0.6875rem] text-ink-faint">
              by {mine ? "you" : recorder.name.split(" ")[0]}
            </span>
          ) : null}
          <ReceiptButton donation={donation} />

          {isAdmin && isPending ? (
            <Button
              size="sm"
              variant="secondary"
              className="ml-auto"
              onClick={async () => {
                const r = await verifyDonation(donation.id);
                toast(r.ok ? "Marked as received." : r.error, r.ok ? "success" : "error");
              }}
            >
              Confirm receipt
            </Button>
          ) : null}
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className={`text-[0.6875rem] font-medium text-ink-soft underline decoration-line-strong underline-offset-2 hover:text-ink ${
                isAdmin && isPending ? "" : "ml-auto"
              }`}
            >
              Edit
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/* ----------------------------------------------------------------- expenses */

export function ExpenseForm({
  open,
  onClose,
  defaultActivityId,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  defaultActivityId?: string | null;
  existing?: Expense;
}) {
  const { data, addExpense, updateExpense } = useSociety();
  const toast = useToast();

  const [title, setTitle] = useState(existing?.title ?? "");
  const [category, setCategory] = useState<Expense["category"]>(
    existing?.category ?? "miscellaneous",
  );
  const [amount, setAmount] = useState<number | "">(existing?.amount ?? "");
  const [vendor, setVendor] = useState(existing?.vendor ?? "");
  const [activityId, setActivityId] = useState<string>(
    existing?.activityId ?? defaultActivityId ?? "",
  );
  const [paidAt, setPaidAt] = useState(existing ? toDateInput(existing.paidAt) : today());
  const [method, setMethod] = useState<Expense["method"]>(existing?.method ?? "upi");
  const [billNo, setBillNo] = useState(existing?.billNo ?? "");
  const [paidBy, setPaidBy] = useState(existing?.paidBy ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (amount === "" || amount <= 0) {
      setError("Please enter the amount paid.");
      return;
    }
    setBusy(true);
    const payload: NewExpense = {
      title,
      category,
      amount,
      vendor: vendor.trim() || undefined,
      activityId: activityId || null,
      paidAt,
      method,
      billNo: billNo.trim() || undefined,
      paidBy: paidBy.trim() || undefined,
      note: note.trim() || undefined,
    };
    const result = existing ? await updateExpense(existing.id, payload) : await addExpense(payload);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast(existing ? "Expense updated." : `${money(amount)} expense recorded.`);
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={existing ? "Edit expense" : "Record an expense"}
      description="Every resident can see this entry, so name the vendor and bill number where you have them."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : existing ? "Save changes" : "Record expense"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="What was it spent on" required>
          <input
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus={!existing}
            placeholder="e.g. Mandap & stage decoration advance"
          />
        </Field>

        <Field label="Amount paid" required>
          <MoneyInput value={amount} onChange={setAmount} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" required>
            <select
              className="field"
              value={category}
              onChange={(e) => setCategory(e.target.value as Expense["category"])}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {humanise(c)}
                </option>
              ))}
            </select>
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

        <Field label="For which activity">
          <select className="field" value={activityId} onChange={(e) => setActivityId(e.target.value)}>
            <option value="">General society spending</option>
            {data.activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Paid to (vendor)">
          <input
            className="field"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="e.g. Shubham Decorators"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Paid by" required>
            <select
              className="field"
              value={method}
              onChange={(e) => setMethod(e.target.value as Expense["method"])}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {methodLabel(m)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Bill / invoice no." hint="So residents can ask to see the paper.">
            <input className="field" value={billNo} onChange={(e) => setBillNo(e.target.value)} />
          </Field>
        </div>

        <Field label="Paid by" hint="Who handed the money over — the person to reimburse.">
          <input className="field" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} />
        </Field>

        <Field label="Note">
          <textarea
            className="field resize-y"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. 50% advance, balance on delivery"
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

/**
 * Opens the attached bill.
 *
 * The bucket is private, so the URL has to be signed on the server first. The
 * tab is opened synchronously on the click and pointed at the URL afterwards:
 * open it after the await and the browser has already forgotten this was a
 * user action, and blocks it as a popup.
 */
function BillLink({ expenseId }: { expenseId: string }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setProblem(null);
          const tab = window.open("", "_blank");
          const res = await fetch(`/api/expenses/${expenseId}/bill`);
          const payload = (await res.json().catch(() => ({}))) as {
            url?: string;
            error?: string;
          };
          setBusy(false);
          if (!res.ok || !payload.url) {
            tab?.close();
            setProblem(payload.error ?? "Could not open the bill.");
            return;
          }
          if (tab) tab.location.href = payload.url;
          else window.location.href = payload.url; // popups blocked
        }}
        className="text-[0.6875rem] font-medium text-brand underline decoration-brand/30 underline-offset-2 disabled:opacity-50"
      >
        {busy ? "Opening…" : "View bill"}
      </button>
      {problem ? <span className="text-[0.6875rem] text-debit">{problem}</span> : null}
    </>
  );
}

export function ExpenseRow({
  expense,
  showActivity = true,
  onEdit,
  canSeeBill = false,
}: {
  expense: Expense;
  showActivity?: boolean;
  onEdit?: () => void;
  /** Committee sessions get the signed link; everyone else just the note. */
  canSeeBill?: boolean;
}) {
  const { activityById, memberById } = useLookups();
  const activity = expense.activityId ? activityById.get(expense.activityId) : null;
  const recorder = memberById.get(expense.recordedBy);

  return (
    <li className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm font-medium text-ink">{expense.title}</p>
        <p className="tnum shrink-0 text-sm font-semibold text-ink">{money(expense.amount)}</p>
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
        <Badge tone="accent">{humanise(expense.category)}</Badge>
        {expense.vendor ? <span className="truncate">{expense.vendor}</span> : null}
        <span className="tnum">{shortDate(expense.paidAt)}</span>
        <span>{methodLabel(expense.method)}</span>
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] text-ink-faint">
        {expense.billNo ? <span className="tnum">Bill {expense.billNo}</span> : null}
        {expense.paidBy ? <span>Paid by {expense.paidBy}</span> : null}
        {expense.hasBill ? (
          canSeeBill ? (
            <BillLink expenseId={expense.id} />
          ) : (
            <span title="Kept with the committee — ask to see it">Bill on file</span>
          )
        ) : null}
      </p>
      {showActivity ? (
        <p className="mt-1 truncate text-xs text-ink-faint">
          {activity ? activity.title : "General society spending"}
        </p>
      ) : null}
      {expense.note ? (
        <p className="mt-1 text-xs italic leading-snug text-ink-soft">{expense.note}</p>
      ) : null}
      <div className="mt-1.5 flex items-center gap-2">
        {recorder ? (
          <span className="text-[0.6875rem] text-ink-faint">Entered by {recorder.name}</span>
        ) : null}
        {expense.editedAt ? (
          <span className="text-[0.6875rem] text-ink-faint">
            · edited {shortDate(expense.editedAt)}
          </span>
        ) : null}
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="ml-auto text-[0.6875rem] font-medium text-ink-soft underline decoration-line-strong underline-offset-2 hover:text-ink"
          >
            Edit
          </button>
        ) : null}
      </div>
    </li>
  );
}

/* --------------------------------------------------------------- activities */

export function ActivityForm({
  open,
  onClose,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  existing?: Activity;
}) {
  const { addActivity, updateActivity } = useSociety();
  const toast = useToast();

  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [category, setCategory] = useState<Activity["category"]>(existing?.category ?? "festival");
  const [startsAt, setStartsAt] = useState(
    existing ? toDateTimeInput(existing.startsAt) : toDateTimeInput(new Date().toISOString()),
  );
  const [endsAt, setEndsAt] = useState(existing?.endsAt ? toDateTimeInput(existing.endsAt) : "");
  const [venue, setVenue] = useState(existing?.venue ?? "");
  const [budget, setBudget] = useState<number | "">(existing?.budget ?? "");
  const [status, setStatus] = useState<Activity["status"]>(existing?.status ?? "planned");
  const [organiser, setOrganiser] = useState(existing?.organiser ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (endsAt && endsAt < startsAt) {
      setError("The end time can't be before the start time.");
      return;
    }
    setBusy(true);
    const payload: NewActivity = {
      title,
      description,
      category,
      startsAt,
      endsAt: endsAt || undefined,
      venue,
      budget: budget === "" ? 0 : budget,
      status,
      organiser: organiser.trim() || "Managing Committee",
    };
    const result = existing
      ? await updateActivity(existing.id, payload)
      : await addActivity(payload);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast(existing ? "Activity updated." : "Activity added to the calendar.");
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={existing ? "Edit activity" : "Plan an activity"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : existing ? "Save changes" : "Add activity"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Activity name" required>
          <input
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus={!existing}
            placeholder="e.g. Janmashtami & Dahi Handi 2026"
          />
        </Field>

        <Field label="What's planned" hint="Shown to residents, and used for the WhatsApp invite.">
          <textarea
            className="field resize-y"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Programme, timings, what volunteers are needed for…"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" required>
            <select
              className="field"
              value={category}
              onChange={(e) => setCategory(e.target.value as Activity["category"])}
            >
              {ACTIVITY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {humanise(c)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status" required>
            <select
              className="field"
              value={status}
              onChange={(e) => setStatus(e.target.value as Activity["status"])}
            >
              {(["planned", "ongoing", "completed", "cancelled"] as const).map((s) => (
                <option key={s} value={s}>
                  {humanise(s)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Starts" required>
          <input
            className="field"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
        </Field>

        <Field label="Ends" hint="Leave blank for a single-session activity.">
          <input
            className="field"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </Field>

        <Field label="Venue" required>
          <input
            className="field"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            required
            placeholder="e.g. Podium & central lawn"
          />
        </Field>

        <Field
          label="Approved budget"
          hint="What the committee sanctioned. Actual spending is tracked against it."
        >
          <MoneyInput value={budget} onChange={setBudget} />
        </Field>

        <Field label="Organised by">
          <input
            className="field"
            value={organiser}
            onChange={(e) => setOrganiser(e.target.value)}
            placeholder="e.g. Festival Committee"
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
