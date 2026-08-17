"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLookups, useSociety } from "@/lib/store";
import { activityFinance, pastActivities, upcomingActivities } from "@/lib/finance";
import { dateTime, humanise, money, relativeDays, shortDate } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Meter,
  PageHeader,
  SectionTitle,
} from "@/components/ui";
import { ActivityForm } from "@/components/entries";
import type { Activity } from "@/lib/types";

const statusTone = {
  planned: "brand",
  ongoing: "accent",
  completed: "neutral",
  cancelled: "debit",
} as const;

export default function ActivitiesPage() {
  const { data, isAdmin } = useSociety();
  const [adding, setAdding] = useState(false);

  const upcoming = useMemo(() => upcomingActivities(data.activities), [data.activities]);
  const past = useMemo(() => pastActivities(data.activities), [data.activities]);

  return (
    <div>
      <PageHeader
        title="Cultural activities"
        subtitle="What's planned, what it will cost, and what each past event actually cost."
        actions={
          isAdmin ? <Button onClick={() => setAdding(true)}>Plan an activity</Button> : undefined
        }
      />

      {!data.activities.length ? (
        <EmptyState
          title="Nothing on the calendar yet"
          description="Add your first activity — a festival, a sports day, a workshop — and residents will see it here."
          action={isAdmin ? <Button onClick={() => setAdding(true)}>Plan an activity</Button> : undefined}
        />
      ) : null}

      {upcoming.length ? (
        <section className="mb-8">
          <SectionTitle>Coming up — {upcoming.length}</SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2">
            {upcoming.map((a) => (
              <ActivityCard key={a.id} activity={a} />
            ))}
          </ul>
        </section>
      ) : null}

      {past.length ? (
        <section>
          <SectionTitle>Completed — {past.length}</SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2">
            {past.map((a) => (
              <ActivityCard key={a.id} activity={a} />
            ))}
          </ul>
        </section>
      ) : null}

      {adding ? <ActivityForm open onClose={() => setAdding(false)} /> : null}
    </div>
  );
}

function ActivityCard({ activity }: { activity: Activity }) {
  const { data } = useSociety();
  const { albumByActivityId, photosByAlbumId } = useLookups();
  const fin = activityFinance(activity, data.donations, data.expenses);
  const album = albumByActivityId.get(activity.id);
  const photoCount = album ? (photosByAlbumId.get(album.id) ?? []).length : 0;
  const isPast = activity.status === "completed" || activity.status === "cancelled";

  return (
    <Card as="li" className="flex flex-col p-4 transition-shadow hover:shadow-sm">
      <Link href={`/activities/${activity.id}`} className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[0.9375rem] font-semibold leading-snug text-ink">{activity.title}</h3>
          <Badge tone={statusTone[activity.status]}>{humanise(activity.status)}</Badge>
        </div>

        <p className="mt-1.5 text-xs text-ink-soft">
          {isPast ? shortDate(activity.startsAt) : dateTime(activity.startsAt)}
          {!isPast ? (
            <span className="text-accent"> · {relativeDays(activity.startsAt)}</span>
          ) : null}
        </p>
        <p className="mt-0.5 truncate text-xs text-ink-faint">{activity.venue}</p>

        <p className="mt-2.5 line-clamp-2 flex-1 text-[0.8125rem] leading-relaxed text-ink-soft">
          {activity.description}
        </p>

        <div className="mt-3.5 space-y-2">
          {isPast ? (
            <Meter
              value={fin.spent}
              total={fin.budget}
              tone={fin.spent > fin.budget ? "debit" : "brand"}
              label={
                <span className="tnum">
                  Spent {money(fin.spent)} of {money(fin.budget)}
                </span>
              }
            />
          ) : (
            <Meter
              value={fin.pledged}
              total={fin.budget}
              label={
                <span className="tnum">
                  Collected {money(fin.pledged)} of {money(fin.budget)}
                </span>
              }
            />
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] text-ink-faint">
          <span className="tnum">{fin.donorCount} contributors</span>
          <span className="tnum">{fin.expenseCount} expenses</span>
          {photoCount ? <span className="tnum">{photoCount} photos</span> : null}
        </div>
      </Link>
    </Card>
  );
}
