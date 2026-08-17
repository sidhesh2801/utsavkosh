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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const openDrives = useMemo(
    () => data.activities.filter((a) => a.status !== "cancelled"),
    [data.activities],
  );

  /** Typing a flat fills in the resident's name, so entries stay consistent. */
  function fillFromFlat(nextWing: string, nextFlat: string) {
    if (!nextWing || !nextFlat) return;
    const match = data.members.find(
      (m) => m.wing.toUpperCase() === nextWing.toUpperCase() && m.flat === nextFlat,
    );
    if (match && !donorName.trim()) setDonorName(match.name);
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
    };
    const result = existing
      ? await updateDonation(existing.id, payload)
      : await addDonation(payload);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast(
      existing
        ? "Entry updated."
        : isAdmin
          ? `${money(amount)} recorded.`
          : `${money(amount)} recorded — the treasurer will confirm it at handover.`,
    );
    onClose();
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

        <Field
          label="Contributor's name"
          hint="Fills in automatically when the flat is on our resident list."
          required
        >
          <input
            className="field"
            value={donorName}
            onChange={(e) => setDonorName(e.target.value)}
            required
            placeholder="e.g. Sunil Kulkarni"
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
            You&apos;re recording as a volunteer collector. Hand the cash to the treasurer and
            they&apos;ll mark it verified — only then does it count towards the society balance.
          </p>
        ) : null}
      </form>
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

export function ExpenseRow({
  expense,
  showActivity = true,
  onEdit,
}: {
  expense: Expense;
  showActivity?: boolean;
  onEdit?: () => void;
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
      {expense.billNo ? (
        <p className="tnum mt-1 text-[0.6875rem] text-ink-faint">Bill {expense.billNo}</p>
      ) : null}
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
