"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { useSociety } from "@/lib/store";
import { fundSummary } from "@/lib/finance";
import { money, shortDate } from "@/lib/format";
import { Button, Card, EmptyState } from "@/components/ui";
import { useCommitteeSession } from "@/components/ledger-admin";
import { FestivalSheet } from "@/components/festival-tiles";

/**
 * One festival's own front page.
 *
 * The same four doors as the society home page, but everything behind them —
 * and the balance above them — belongs to this festival alone. Which is the
 * point: a resident asking "how did Ganeshotsav go" should not have to
 * subtract Janmashtami from a combined figure in their head.
 */
export default function FestivalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data } = useSociety();
  const committee = useCommitteeSession();
  const [editing, setEditing] = useState(false);

  const activity = data.activities.find((a) => a.id === id);

  const summary = useMemo(
    () =>
      fundSummary(
        data.donations.filter((d) => d.activityId === id),
        data.expenses.filter((e) => e.activityId === id),
      ),
    [data, id],
  );

  const coupons = 0; // registrations are committee-only; the counter shows them

  if (!activity) {
    // Also the state while the register is still loading, which is why this
    // says "may still be loading" rather than flatly denying it exists.
    return (
      <EmptyState
        title="No such festival"
        description="It may still be loading, or the link may be out of date."
        action={
          <Link
            href="/"
            className="inline-flex items-center rounded-[10px] bg-brand px-4 py-2.5 text-[0.8125rem] font-medium text-white"
          >
            Back to all festivals
          </Link>
        }
      />
    );
  }

  const dates = activity.endsAt
    ? `${shortDate(activity.startsAt)} – ${shortDate(activity.endsAt)}`
    : shortDate(activity.startsAt);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/"
          className="text-[0.8125rem] text-ink-soft underline decoration-line-strong underline-offset-2 hover:text-ink"
        >
          ← All festivals
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[1.375rem] font-semibold tracking-[-0.01em] text-ink sm:text-2xl">
              {activity.title}
            </h1>
            <p className="tnum mt-1 text-sm text-ink-soft">
              {dates}
              {activity.venue ? ` · ${activity.venue}` : ""}
            </p>
          </div>
          {committee.authenticated ? (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : null}
        </div>
        {activity.description ? (
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
            {activity.description}
          </p>
        ) : null}
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-line bg-brand-soft px-5 py-5">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-brand-ink/70">
            Balance for this festival
          </p>
          <p className="tnum mt-1 text-[2.75rem] font-semibold leading-none tracking-[-0.02em] text-brand-ink">
            {money(summary.balance)}
          </p>
          <p className="tnum mt-2 text-[0.8125rem] leading-snug text-brand-ink/80">
            {money(summary.collected)} collected · {money(summary.spent)} spent
          </p>
        </div>
        {activity.budget > 0 ? (
          <div className="border-b border-line px-5 py-3">
            <p className="tnum text-[0.8125rem] text-ink-soft">
              Budgeted {money(activity.budget)} —{" "}
              {summary.spent > activity.budget ? (
                <span className="text-debit">
                  {money(summary.spent - activity.budget)} over
                </span>
              ) : (
                <span className="text-credit">
                  {money(activity.budget - summary.spent)} still to spend
                </span>
              )}
            </p>
          </div>
        ) : null}
        {summary.pendingCollection > 0 ? (
          <div className="px-5 py-3">
            <p className="tnum text-[0.8125rem] text-warn">
              {money(summary.pendingCollection)} is recorded but not yet with the treasurer, so it
              is not counted above.
            </p>
          </div>
        ) : null}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Door
          href={`/donations?activity=${activity.id}`}
          title="Donations"
          description="Who contributed to this festival, and from which flat."
          meta={`${summary.donationCount} ${summary.donationCount === 1 ? "entry" : "entries"}`}
        />
        <Door
          href={`/ledger?activity=${activity.id}`}
          title="Ledger"
          description="What this festival spent, with vendor and bill number."
          meta={`${summary.expenseCount} ${summary.expenseCount === 1 ? "entry" : "entries"}`}
        />
        <Door
          href={`/food-coupon?activity=${activity.id}`}
          title="Food coupon"
          description="Register your flat and get a QR for the counter."
          meta={coupons ? `${coupons} registered` : "No login needed"}
        />
        <Door
          href="/receipt-generator.html"
          external
          title="Write a receipt"
          description="For the committee and collection volunteers."
          meta="Password needed"
        />
      </div>

      {editing ? (
        <FestivalSheet
          existing={activity}
          onClose={() => setEditing(false)}
          onSaved={() => window.location.reload()}
        />
      ) : null}
    </div>
  );
}

function Door({
  href,
  title,
  description,
  meta,
  external,
}: {
  href: string;
  title: string;
  description: string;
  meta: string;
  external?: boolean;
}) {
  const body = (
    <Card className="h-full px-4 py-3.5 transition-colors hover:border-line-strong">
      <p className="text-[0.9375rem] font-semibold text-ink">{title}</p>
      <p className="mt-1 text-[0.8125rem] leading-snug text-ink-soft">{description}</p>
      <p className="mt-2 text-[0.6875rem] text-ink-faint">{meta}</p>
    </Card>
  );
  return external ? (
    <a href={href} className="block">
      {body}
    </a>
  ) : (
    <Link href={href} className="block">
      {body}
    </Link>
  );
}
