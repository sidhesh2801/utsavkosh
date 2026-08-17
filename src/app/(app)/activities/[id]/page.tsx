"use client";

import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useLookups, useSociety } from "@/lib/store";
import { activityFinance, expensesByCategory } from "@/lib/finance";
import { dateTime, humanise, money, relativeDays } from "@/lib/format";
import { activityInviteMessage, activityUpdateMessage } from "@/lib/messages";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LinkButton,
  Meter,
  SectionTitle,
  Skeleton,
  StatTile,
  useConfirm,
  useToast,
} from "@/components/ui";
import { CategoryBars } from "@/components/charts";
import { ShareButton } from "@/components/share";
import {
  ActivityForm,
  DonationForm,
  DonationRow,
  ExpenseForm,
  ExpenseRow,
} from "@/components/entries";
import { PhotoTile } from "@/components/photo";

const statusTone = {
  planned: "brand",
  ongoing: "accent",
  completed: "neutral",
  cancelled: "debit",
} as const;

export default function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, ready, isAdmin, canCollect, deleteActivity } = useSociety();
  const { albumByActivityId, photosByAlbumId } = useLookups();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [addingDonation, setAddingDonation] = useState(false);
  const [addingExpense, setAddingExpense] = useState(false);

  const activity = data.activities.find((a) => a.id === id);

  const fin = useMemo(
    () => (activity ? activityFinance(activity, data.donations, data.expenses) : null),
    [activity, data.donations, data.expenses],
  );

  if (!ready) return <Skeleton className="h-72" />;
  if (!activity || !fin) notFound();

  const donations = data.donations
    .filter((d) => d.activityId === activity.id)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const expenses = data.expenses
    .filter((e) => e.activityId === activity.id)
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  const categories = expensesByCategory(expenses);

  const album = albumByActivityId.get(activity.id);
  const photos = album ? (photosByAlbumId.get(album.id) ?? []) : [];
  const isPast = activity.status === "completed" || activity.status === "cancelled";

  return (
    <div className="space-y-6">
      <Link
        href="/activities"
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
        All activities
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone[activity.status]}>{humanise(activity.status)}</Badge>
          <Badge>{humanise(activity.category)}</Badge>
          {!isPast ? <Badge tone="accent">{relativeDays(activity.startsAt)}</Badge> : null}
        </div>
        <h1 className="mt-2 text-[1.375rem] font-semibold tracking-[-0.01em] text-ink sm:text-2xl">
          {activity.title}
        </h1>
        <dl className="mt-2.5 space-y-1 text-[0.8125rem] text-ink-soft">
          <div className="flex gap-2">
            <dt className="sr-only">When</dt>
            <dd>
              {dateTime(activity.startsAt)}
              {activity.endsAt ? ` — ${dateTime(activity.endsAt)}` : ""}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="sr-only">Where</dt>
            <dd>{activity.venue}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="sr-only">Organised by</dt>
            <dd>Organised by the {activity.organiser}</dd>
          </div>
        </dl>

        <p className="mt-3.5 max-w-2xl text-sm leading-relaxed text-ink-soft">
          {activity.description}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ShareButton
            message={activityUpdateMessage(data.society, activity, fin)}
            label="Share fund update"
            size="sm"
          />
          {!isPast ? (
            <ShareButton
              message={activityInviteMessage(data.society, activity)}
              label="Share invite"
              variant="ghost"
              size="sm"
            />
          ) : null}
          {canCollect && !isPast ? (
            <LinkButton href={`/collect?activity=${activity.id}`} size="sm">
              Record a contribution
            </LinkButton>
          ) : null}
          {isAdmin ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  if (!confirm(`Delete “${activity.title}”? This cannot be undone.`)) return;
                  const r = await deleteActivity(activity.id);
                  if (!r.ok) toast(r.error, "error");
                  else {
                    toast("Activity deleted.");
                    router.push("/activities");
                  }
                }}
              >
                Delete
              </Button>
            </>
          ) : null}
        </div>
      </header>

      {/* Money */}
      <section>
        <SectionTitle>Fund position</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Collected" value={money(fin.collected)} tone="credit" />
          <StatTile label="Spent" value={money(fin.spent)} tone="debit" />
          <StatTile
            label={fin.balance < 0 ? "Shortfall" : "Balance"}
            value={money(fin.balance)}
            tone={fin.balance < 0 ? "debit" : "brand"}
          />
          <StatTile
            label="Approved budget"
            value={money(fin.budget)}
            hint={
              fin.budgetRemaining < 0
                ? `Over budget by ${money(-fin.budgetRemaining)}`
                : `${money(fin.budgetRemaining)} left`
            }
            tone={fin.budgetRemaining < 0 ? "debit" : "neutral"}
          />
        </div>

        <Card className="mt-3 space-y-4 p-4">
          <Meter
            value={fin.spent}
            total={fin.budget}
            tone={fin.spent > fin.budget ? "debit" : "brand"}
            label={
              <>
                Spending against budget —{" "}
                <span className="tnum font-medium text-ink">{money(fin.spent)}</span> of{" "}
                {money(fin.budget)}
              </>
            }
          />
          <Meter
            value={fin.collected}
            total={fin.budget}
            tone="credit"
            label={
              <>
                Collections against budget —{" "}
                <span className="tnum font-medium text-ink">{money(fin.collected)}</span> of{" "}
                {money(fin.budget)}
              </>
            }
          />
          {fin.pendingCollection > 0 ? (
            <p className="text-xs leading-relaxed text-warn">
              A further {money(fin.pendingCollection)} has been collected by volunteers and is
              awaiting handover to the treasurer. It is not included in the figures above.
            </p>
          ) : null}
        </Card>
      </section>

      {/* Photos */}
      {photos.length ? (
        <section>
          <SectionTitle
            action={
              album ? (
                <Link
                  href={`/gallery/${album.id}`}
                  className="text-xs font-medium text-ink-soft underline decoration-line-strong underline-offset-2 hover:text-ink"
                >
                  Open album
                </Link>
              ) : undefined
            }
          >
            Photographs — {photos.length}
          </SectionTitle>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {photos.slice(0, 6).map((p) => (
              <PhotoTile key={p.id} photo={p} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Expenses */}
      <section>
        <SectionTitle
          action={
            isAdmin ? (
              <Button size="sm" variant="secondary" onClick={() => setAddingExpense(true)}>
                Add expense
              </Button>
            ) : undefined
          }
        >
          Where the money went — {expenses.length} entries
        </SectionTitle>
        {expenses.length ? (
          <>
            <Card className="mb-3 p-4">
              <CategoryBars slices={categories} />
            </Card>
            <Card>
              <ul className="divide-y divide-line">
                {expenses.map((e) => (
                  <ExpenseRow key={e.id} expense={e} showActivity={false} />
                ))}
              </ul>
            </Card>
          </>
        ) : (
          <EmptyState
            title="Nothing spent on this activity yet"
            description="Expenses appear here with the vendor and bill number, visible to every resident."
          />
        )}
      </section>

      {/* Donations */}
      <section>
        <SectionTitle
          action={
            canCollect ? (
              <Button size="sm" variant="secondary" onClick={() => setAddingDonation(true)}>
                Add contribution
              </Button>
            ) : undefined
          }
        >
          Contributions received — {donations.length} entries
        </SectionTitle>
        {donations.length ? (
          <Card>
            <ul className="divide-y divide-line">
              {donations.map((d) => (
                <DonationRow key={d.id} donation={d} showActivity={false} />
              ))}
            </ul>
          </Card>
        ) : (
          <EmptyState title="No contributions recorded for this activity yet" />
        )}
      </section>

      {editing ? (
        <ActivityForm open existing={activity} onClose={() => setEditing(false)} />
      ) : null}
      {addingDonation ? (
        <DonationForm
          open
          defaultActivityId={activity.id}
          onClose={() => setAddingDonation(false)}
        />
      ) : null}
      {addingExpense ? (
        <ExpenseForm open defaultActivityId={activity.id} onClose={() => setAddingExpense(false)} />
      ) : null}
    </div>
  );
}
