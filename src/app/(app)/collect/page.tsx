"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSociety } from "@/lib/store";
import {
  activityFinance,
  collectorTotals,
  contributedFlats,
  upcomingActivities,
} from "@/lib/finance";
import { flatLabel, money, relativeDays, shortDate, timeOfDay } from "@/lib/format";
import { collectionRequestMessage, handoverReminderMessage } from "@/lib/messages";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Meter,
  PageHeader,
  SectionTitle,
  Skeleton,
  StatTile,
  useToast,
} from "@/components/ui";
import { ShareButton } from "@/components/share";
import { DonationForm, DonationRow } from "@/components/entries";

export default function CollectPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <CollectScreen />
    </Suspense>
  );
}

function CollectScreen() {
  const { data, session, isAdmin, canCollect } = useSociety();
  const params = useSearchParams();

  const drives = useMemo(() => {
    const upcoming = upcomingActivities(data.activities);
    // Anything still collecting: upcoming first, then recently completed.
    const rest = data.activities
      .filter((a) => !upcoming.includes(a) && a.status !== "cancelled")
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    return [...upcoming, ...rest];
  }, [data.activities]);

  const [activityId, setActivityId] = useState<string>(
    params.get("activity") ?? drives[0]?.id ?? "",
  );
  const [adding, setAdding] = useState(false);

  if (!canCollect) {
    return (
      <EmptyState
        title="Collections are recorded by the committee and volunteers"
        description="If you'd like to help with the door-to-door collection, ask a committee admin to make you a volunteer collector."
      />
    );
  }

  const activity = data.activities.find((a) => a.id === activityId) ?? null;
  const driveDonations = activity
    ? data.donations.filter((d) => d.activityId === activity.id)
    : [];
  const fin = activity ? activityFinance(activity, data.donations, data.expenses) : null;
  const totals = collectorTotals(driveDonations);

  const myEntries = driveDonations.filter((d) => d.recordedBy === session?.id);
  const myPending = myEntries.filter((d) => d.status === "pending");
  const myPendingTotal = myPending.reduce((t, d) => t + d.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Collection drive"
        subtitle={
          isAdmin
            ? "Record contributions, and confirm cash as volunteers hand it over."
            : "Record what you collect at each door. The treasurer confirms it at handover."
        }
      />

      {drives.length ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[14rem] flex-1">
            <span className="mb-1.5 block text-[0.8125rem] font-medium text-ink">
              Collecting for
            </span>
            <select
              className="field"
              value={activityId}
              onChange={(e) => setActivityId(e.target.value)}
            >
              {drives.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </label>
          <Button size="lg" onClick={() => setAdding(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Record contribution
          </Button>
        </div>
      ) : (
        <EmptyState
          title="No activities to collect for yet"
          description="Add an activity first, then contributions can be recorded against it."
        />
      )}

      {activity && fin ? (
        <>
          {/* Live progress */}
          <Card className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-ink">{activity.title}</h2>
                <p className="mt-0.5 text-[0.8125rem] text-ink-soft">
                  {shortDate(activity.startsAt)} · {relativeDays(activity.startsAt)}
                </p>
              </div>
              <ShareButton
                size="sm"
                label="Ask the group to contribute"
                message={collectionRequestMessage(
                  data.society,
                  activity,
                  fin,
                  data.members
                    .filter((m) => m.role === "collector" && m.status === "approved")
                    .map((m) => m.name.split(" ")[0]),
                )}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Verified" value={money(fin.collected)} tone="credit" />
              <StatTile
                label="With volunteers"
                value={money(fin.pendingCollection)}
                tone={fin.pendingCollection > 0 ? "warn" : "neutral"}
              />
              <StatTile label="Spent" value={money(fin.spent)} tone="debit" />
              <StatTile label="Budget" value={money(fin.budget)} />
            </div>

            <div className="mt-4">
              <Meter
                value={fin.pledged}
                total={fin.budget}
                label={
                  <>
                    <span className="tnum font-medium text-ink">{money(fin.pledged)}</span> collected
                    of {money(fin.budget)} budget · {fin.donorCount} families
                  </>
                }
              />
            </div>
          </Card>

          {/* A volunteer's own handover position */}
          {!isAdmin && myPending.length ? (
            <Card className="border-warn/30 bg-warn-soft/40 p-4">
              <p className="text-sm font-semibold text-warn">
                You&apos;re holding {money(myPendingTotal)}
              </p>
              <p className="mt-1 text-[0.8125rem] leading-snug text-ink-soft">
                From {myPending.length} {myPending.length === 1 ? "flat" : "flats"}. Please hand it
                to the treasurer — it only counts towards the society balance once confirmed.
              </p>
            </Card>
          ) : null}

          {/* Handover ledger per volunteer */}
          <section>
            <SectionTitle>Who has collected what</SectionTitle>
            {totals.length ? (
              <Card>
                <ul className="divide-y divide-line">
                  {totals.map((t) => (
                    <CollectorRow
                      key={t.collectorId}
                      total={t}
                      activityId={activity.id}
                      activityTitle={activity.title}
                    />
                  ))}
                </ul>
              </Card>
            ) : (
              <EmptyState
                title="No contributions recorded for this activity yet"
                description="Tap “Record contribution” to add the first one."
              />
            )}
          </section>

          <NotYetContributed activityId={activity.id} />

          {/* The drive's entries */}
          <section>
            <SectionTitle>
              {isAdmin ? "All entries for this drive" : "Entries you recorded"}
            </SectionTitle>
            {(isAdmin ? driveDonations : myEntries).length ? (
              <Card>
                <ul className="divide-y divide-line">
                  {(isAdmin ? driveDonations : myEntries)
                    .slice()
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                    .map((d) => (
                      <DonationRow key={d.id} donation={d} showActivity={false} />
                    ))}
                </ul>
              </Card>
            ) : (
              <EmptyState title="You haven't recorded anything for this drive yet" />
            )}
          </section>
        </>
      ) : null}

      {adding ? (
        <DonationForm open defaultActivityId={activityId} onClose={() => setAdding(false)} />
      ) : null}
    </div>
  );
}

function CollectorRow({
  total,
  activityId,
  activityTitle,
}: {
  total: ReturnType<typeof collectorTotals>[number];
  activityId: string;
  activityTitle: string;
}) {
  const { data, isAdmin, verifyAllFrom, session } = useSociety();
  const toast = useToast();
  const member = data.members.find((m) => m.id === total.collectorId);
  const name = member?.name ?? "Unknown";
  const isMe = total.collectorId === session?.id;

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <Avatar name={name} tone={member?.role === "admin" ? "brand" : "accent"} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">
          {name}
          {isMe ? <span className="ml-1.5 text-xs font-normal text-ink-faint">(you)</span> : null}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-soft">
          <span className="tnum">
            {total.count} {total.count === 1 ? "flat" : "flats"}
          </span>
          <span className="tnum">{money(total.total)} total</span>
          {/* Only show a clock time for entries that actually carry one —
              date-only records would otherwise all read as midnight. */}
          {total.lastEntryAt ? (
            <span className="tnum text-ink-faint">
              {total.lastEntryAt.includes("T")
                ? `last at ${timeOfDay(total.lastEntryAt)}`
                : `last on ${shortDate(total.lastEntryAt)}`}
            </span>
          ) : null}
        </p>
        {total.pendingAmount > 0 ? (
          <Badge tone="warn" className="mt-1.5">
            {money(total.pendingAmount)} to hand over
          </Badge>
        ) : (
          <Badge tone="credit" className="mt-1.5">
            All handed over
          </Badge>
        )}
      </div>

      {isAdmin && total.pendingAmount > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <ShareButton
            size="sm"
            variant="ghost"
            preview={false}
            label="Remind"
            message={handoverReminderMessage(
              name,
              total.pendingAmount,
              total.count,
              activityTitle,
            )}
          />
          <Button
            size="sm"
            onClick={async () => {
              const r = await verifyAllFrom(total.collectorId, activityId);
              toast(
                r.ok ? `Confirmed ${r.value} entries from ${name}.` : r.error,
                r.ok ? "success" : "error",
              );
            }}
          >
            Confirm handover
          </Button>
        </div>
      ) : null}
    </li>
  );
}

/**
 * Which flats haven't given yet — the working list for door-to-door collection,
 * and the reason a volunteer opens this screen on the landing.
 */
function NotYetContributed({ activityId }: { activityId: string }) {
  const { data } = useSociety();
  const [open, setOpen] = useState(false);

  const remaining = useMemo(() => {
    const given = contributedFlats(data.donations.filter((d) => d.activityId === activityId));
    return data.members
      .filter((m) => m.status === "approved" && m.wing && m.flat)
      .filter((m) => !given.has(`${m.wing.toUpperCase()}-${m.flat}`))
      .sort((a, b) => `${a.wing}${a.flat}`.localeCompare(`${b.wing}${b.flat}`));
  }, [data.donations, data.members, activityId]);

  if (!remaining.length) {
    return (
      <Card className="p-4">
        <p className="text-sm font-medium text-credit">
          Every registered flat has contributed to this drive 🎉
        </p>
      </Card>
    );
  }

  return (
    <section>
      <SectionTitle
        action={
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="text-xs font-medium text-ink-soft underline decoration-line-strong underline-offset-2 hover:text-ink"
          >
            {open ? "Hide list" : "Show list"}
          </button>
        }
      >
        Still to visit — {remaining.length} flats
      </SectionTitle>
      {open ? (
        <Card>
          <ul className="divide-y divide-line">
            {remaining.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="tnum w-16 shrink-0 text-[0.8125rem] font-medium text-ink">
                  {flatLabel(m.wing, m.flat)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink-soft">
                  {m.name}
                </span>
                {m.mobile ? (
                  <a
                    href={`tel:${m.mobile.replace(/\s/g, "")}`}
                    className="tnum shrink-0 text-xs text-brand underline decoration-brand/30 underline-offset-2"
                  >
                    {m.mobile}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <p className="text-[0.8125rem] text-ink-soft">
          Only flats on the resident register are counted here, so contributions from tenants or
          guests won&apos;t affect this list.
        </p>
      )}
    </section>
  );
}
