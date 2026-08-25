"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSociety } from "@/lib/store";
import { fundSummary } from "@/lib/finance";
import { money, shortDate } from "@/lib/format";
import type { Activity } from "@/lib/types";
import { Button, Card, Field, Sheet, useToast } from "./ui";
import { useCommitteeSession } from "./ledger-admin";

/**
 * One tile per festival, and the way into each.
 *
 * The society runs several a year and their money must not be added together:
 * "we have ₹69,489" is meaningless if it is Janmashtami's surplus and
 * Ganeshotsav's float in one number. Each tile carries its own collected,
 * spent and balance, and opens a page that is only about that festival.
 *
 * Ordered nearest-first with anything upcoming ahead of anything finished,
 * because the festival being run right now is the one everybody has come for.
 */

interface Standing {
  activity: Activity;
  collected: number;
  spent: number;
  balance: number;
  donors: number;
}

export function FestivalTiles() {
  const { data } = useSociety();
  const committee = useCommitteeSession();
  const [adding, setAdding] = useState(false);

  const standings = useMemo<Standing[]>(() => {
    const today = new Date().toISOString().slice(0, 10);
    return data.activities
      .map((activity) => {
        const donations = data.donations.filter((d) => d.activityId === activity.id);
        const expenses = data.expenses.filter((e) => e.activityId === activity.id);
        const s = fundSummary(donations, expenses);
        return {
          activity,
          collected: s.collected,
          spent: s.spent,
          balance: s.balance,
          donors: donations.length,
        };
      })
      .sort((a, b) => {
        // Upcoming and ongoing first, in date order; finished ones after, most
        // recent first. A festival three weeks away matters more than one from
        // last year, whichever way a plain date sort would put them.
        const aOver = a.activity.startsAt.slice(0, 10) < today;
        const bOver = b.activity.startsAt.slice(0, 10) < today;
        if (aOver !== bOver) return aOver ? 1 : -1;
        return aOver
          ? b.activity.startsAt.localeCompare(a.activity.startsAt)
          : a.activity.startsAt.localeCompare(b.activity.startsAt);
      });
  }, [data]);

  // Money recorded against no festival at all — society spending, or a
  // contribution that came in before anyone opened the next one.
  const general = useMemo(() => {
    const donations = data.donations.filter((d) => d.activityId === null);
    const expenses = data.expenses.filter((e) => e.activityId === null);
    if (!donations.length && !expenses.length) return null;
    return fundSummary(donations, expenses);
  }, [data]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[0.9375rem] font-semibold text-ink">Festivals</h2>
        {committee.authenticated ? (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            Add a festival
          </Button>
        ) : null}
      </div>

      {standings.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {standings.map((s) => (
            <FestivalTile key={s.activity.id} standing={s} />
          ))}
        </div>
      ) : (
        <Card className="px-5 py-6 text-center">
          <p className="text-sm text-ink-soft">
            No festival has been opened yet.
            {committee.authenticated
              ? " Add one and the donations, ledger and food coupons all hang off it."
              : ""}
          </p>
        </Card>
      )}

      {general ? (
        <Link href="/donations" className="block">
          <Card className="flex items-center gap-3 px-4 py-3 transition-colors hover:border-line-strong">
            <span className="min-w-0 flex-1">
              <span className="block text-[0.8125rem] font-medium text-ink">
                General society fund
              </span>
              <span className="tnum block text-xs text-ink-faint">
                {money(general.collected)} in · {money(general.spent)} out — not tied to a festival
              </span>
            </span>
            <Chevron />
          </Card>
        </Link>
      ) : null}

      {adding ? (
        <FestivalSheet
          onClose={() => setAdding(false)}
          onSaved={() => window.location.reload()}
        />
      ) : null}
    </div>
  );
}

function FestivalTile({ standing }: { standing: Standing }) {
  const { activity, collected, spent, balance, donors } = standing;
  const when = shortDate(activity.startsAt);
  const today = new Date().toISOString().slice(0, 10);
  const over = activity.startsAt.slice(0, 10) < today;

  return (
    <Link href={`/festival/${activity.id}`} className="block">
      <Card className="h-full overflow-hidden transition-colors hover:border-line-strong">
        <div className="border-b border-line bg-brand-soft px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 flex-1 text-[0.9375rem] font-semibold leading-snug text-brand-ink">
              {activity.title}
            </p>
            <Chevron tone="brand" />
          </div>
          <p className="tnum mt-0.5 text-xs text-brand-ink/70">
            {when}
            {activity.venue ? ` · ${activity.venue}` : ""}
            {over ? " · finished" : ""}
          </p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-line">
          <Figure label="Collected" value={money(collected)} tone="text-credit" />
          <Figure label="Spent" value={money(spent)} tone="text-debit" />
          <Figure label="Balance" value={money(balance)} tone="text-ink" />
        </div>
        <p className="border-t border-line px-4 py-2 text-[0.6875rem] text-ink-faint">
          {donors} {donors === 1 ? "contribution" : "contributions"}
        </p>
      </Card>
    </Link>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="px-3 py-2.5">
      <p className="text-[0.625rem] font-semibold uppercase tracking-[0.05em] text-ink-faint">
        {label}
      </p>
      <p className={`tnum mt-0.5 text-[0.9375rem] font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function Chevron({ tone }: { tone?: "brand" }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={`shrink-0 ${tone === "brand" ? "text-brand-ink/50" : "text-ink-faint"}`}
    >
      <path
        d="M9 5l7 7-7 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------ opening a festival */

/**
 * Creating or renaming a festival, for the committee.
 *
 * Writes through /api/activities rather than the store, for the same reason
 * the ledger does: the committee login is the app's own, not a Supabase Auth
 * account, so the write needs a server route holding the service key.
 */
export function FestivalSheet({
  onClose,
  onSaved,
  existing,
}: {
  onClose: () => void;
  onSaved: () => void;
  existing?: Activity;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [startsAt, setStartsAt] = useState(
    (existing?.startsAt ?? new Date().toISOString()).slice(0, 10),
  );
  const [endsAt, setEndsAt] = useState(existing?.endsAt?.slice(0, 10) ?? "");
  const [venue, setVenue] = useState(existing?.venue ?? "");
  const [budget, setBudget] = useState(existing?.budget ? String(existing.budget) : "");
  const [status, setStatus] = useState(existing?.status ?? "planned");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/activities", {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(existing ? { id: existing.id } : {}),
        title,
        startsAt,
        endsAt: endsAt || null,
        venue,
        budget: Number(budget) || 0,
        status,
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(payload.error ?? "Could not save it.");
      setBusy(false);
      return;
    }
    toast(existing ? "Festival updated." : `${title} is open.`);
    onSaved();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={existing ? "Edit festival" : "Open a festival"}
      description="Donations, ledger entries and food coupons all attach to a festival, so each one's money stays separate."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : existing ? "Save changes" : "Open it"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Name" required>
          <input
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g. Ganeshotsav 2026"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts" required>
            <input
              className="field"
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
            />
          </Field>
          <Field label="Ends" hint="Leave blank for a single day.">
            <input
              className="field"
              type="date"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Where">
            <input
              className="field"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="e.g. Central podium"
            />
          </Field>
          <Field label="Budget ₹" hint="An estimate is fine.">
            <input
              className="field tnum"
              inputMode="decimal"
              value={budget}
              onChange={(e) => setBudget(e.target.value.replace(/[^0-9.]/g, ""))}
            />
          </Field>
        </div>

        <Field label="Status">
          <select className="field" value={status} onChange={(e) => setStatus(e.target.value as Activity["status"])}>
            <option value="planned">Planned</option>
            <option value="ongoing">Happening now</option>
            <option value="completed">Finished</option>
            <option value="cancelled">Cancelled</option>
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
