"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLookups, useSociety } from "@/lib/store";
import {
  activityFinance,
  fundSummary,
  ledger,
  upcomingActivities,
} from "@/lib/finance";
import { dateTime, money, relativeDays, shortDate } from "@/lib/format";
import { activityUpdateMessage } from "@/lib/messages";
import { Badge, Card, LinkButton, Meter, SectionTitle } from "@/components/ui";
import { ShareButton } from "@/components/share";
import { PhotoTile } from "@/components/photo";

export default function HomePage() {
  const { data, session, canCollect } = useSociety();
  const { photosByAlbumId } = useLookups();

  const summary = useMemo(() => fundSummary(data.donations, data.expenses), [data]);
  const upcoming = useMemo(() => upcomingActivities(data.activities), [data.activities]);
  const recent = useMemo(() => ledger(data.donations, data.expenses).slice(0, 6), [data]);

  /** The nearest upcoming activity is the one everyone is working towards. */
  const featured = upcoming[0];
  const featuredFinance = featured
    ? activityFinance(featured, data.donations, data.expenses)
    : null;

  const latestAlbum = useMemo(
    () => [...data.albums].sort((a, b) => b.date.localeCompare(a.date))[0],
    [data.albums],
  );
  const latestPhotos = latestAlbum ? (photosByAlbumId.get(latestAlbum.id) ?? []).slice(0, 4) : [];

  const firstName = session?.name.split(" ")[0] ?? "";

  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm text-ink-soft">Namaste, {firstName} 🙏</p>
        <h1 className="mt-0.5 text-[1.375rem] font-semibold tracking-[-0.01em] text-ink sm:text-2xl">
          Here&apos;s where the society stands today
        </h1>
      </div>

      {/* Hero figure — exactly one per view. */}
      <Card className="overflow-hidden">
        <div className="border-b border-line bg-brand-soft px-5 py-5">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-brand-ink/70">
            Balance in hand
          </p>
          <p className="mt-1 text-[2.75rem] font-semibold leading-none tracking-[-0.02em] text-brand-ink">
            {money(summary.balance)}
          </p>
          <p className="mt-2 text-[0.8125rem] leading-snug text-brand-ink/80">
            {money(summary.collected)} collected, {money(summary.spent)} spent, across{" "}
            {summary.donorCount} contributing families.
          </p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-line border-b border-line sm:grid-cols-3 sm:divide-x">
          <MiniStat label="Total collected" value={money(summary.collected)} />
          <MiniStat label="Total spent" value={money(summary.spent)} />
          <MiniStat
            label="Awaiting handover"
            value={money(summary.pendingCollection)}
            hint={
              summary.pendingCount
                ? `${summary.pendingCount} entries with volunteers`
                : "Nothing pending"
            }
            tone={summary.pendingCollection > 0 ? "warn" : "neutral"}
            className="col-span-2 sm:col-span-1"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <LinkButton href="/funds" variant="secondary" size="sm">
            See every entry
          </LinkButton>
          <Link
            href="/funds/report"
            className="text-[0.8125rem] font-medium text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand"
          >
            Transparency report
          </Link>
        </div>
      </Card>

      {/* The live drive */}
      {featured && featuredFinance ? (
        <section>
          <SectionTitle
            action={
              <Link
                href="/activities"
                className="text-xs font-medium text-ink-soft underline decoration-line-strong underline-offset-2 hover:text-ink"
              >
                All activities
              </Link>
            }
          >
            Coming up next
          </SectionTitle>
          <Card className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-ink">{featured.title}</h3>
                  <Badge tone="accent">{relativeDays(featured.startsAt)}</Badge>
                </div>
                <p className="mt-1 text-[0.8125rem] text-ink-soft">
                  {dateTime(featured.startsAt)} · {featured.venue}
                </p>
              </div>
            </div>

            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-soft">
              {featured.description}
            </p>

            <div className="mt-4 space-y-3">
              <Meter
                value={featuredFinance.collected}
                total={featuredFinance.budget}
                label={
                  <>
                    <span className="tnum font-medium text-ink">
                      {money(featuredFinance.collected)}
                    </span>{" "}
                    collected of {money(featuredFinance.budget)} budget
                  </>
                }
              />
              {featuredFinance.pendingCollection > 0 ? (
                <p className="text-xs text-warn">
                  + {money(featuredFinance.pendingCollection)} collected by volunteers, awaiting
                  handover to the treasurer.
                </p>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <LinkButton href={`/activities/${featured.id}`} variant="secondary" size="sm">
                Open activity
              </LinkButton>
              {canCollect ? (
                <LinkButton href={`/collect?activity=${featured.id}`} size="sm">
                  Record a contribution
                </LinkButton>
              ) : null}
              <ShareButton
                size="sm"
                message={activityUpdateMessage(data.society, featured, featuredFinance)}
                label="Share update"
              />
            </div>
          </Card>
        </section>
      ) : null}

      {/* Other upcoming */}
      {upcoming.length > 1 ? (
        <section>
          <SectionTitle>Also planned</SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2">
            {upcoming.slice(1, 5).map((a) => {
              const fin = activityFinance(a, data.donations, data.expenses);
              return (
                <Card as="li" key={a.id} className="p-4">
                  <Link href={`/activities/${a.id}`} className="block">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-ink">{a.title}</h3>
                      <span className="shrink-0 text-[0.6875rem] text-ink-faint">
                        {relativeDays(a.startsAt)}
                      </span>
                    </div>
                    <p className="tnum mt-1 text-xs text-ink-soft">{shortDate(a.startsAt)}</p>
                    <div className="mt-3">
                      <Meter
                        value={fin.collected}
                        total={fin.budget}
                        showPct={false}
                        label={
                          <span className="tnum">
                            {money(fin.collected)} of {money(fin.budget)}
                          </span>
                        }
                      />
                    </div>
                  </Link>
                </Card>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Gallery teaser */}
      {latestAlbum && latestPhotos.length ? (
        <section>
          <SectionTitle
            action={
              <Link
                href="/gallery"
                className="text-xs font-medium text-ink-soft underline decoration-line-strong underline-offset-2 hover:text-ink"
              >
                All albums
              </Link>
            }
          >
            Latest photographs
          </SectionTitle>
          <Card className="p-4">
            <Link href={`/gallery/${latestAlbum.id}`} className="block">
              <p className="text-sm font-semibold text-ink">{latestAlbum.title}</p>
              <p className="tnum mt-0.5 text-xs text-ink-soft">{shortDate(latestAlbum.date)}</p>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {latestPhotos.map((p) => (
                  <PhotoTile key={p.id} photo={p} />
                ))}
              </div>
            </Link>
          </Card>
        </section>
      ) : null}

      {/* Recent ledger */}
      <section>
        <SectionTitle
          action={
            <Link
              href="/funds"
              className="text-xs font-medium text-ink-soft underline decoration-line-strong underline-offset-2 hover:text-ink"
            >
              Full ledger
            </Link>
          }
        >
          Latest entries
        </SectionTitle>
        <Card>
          <ul className="divide-y divide-line">
            {recent.map((item) => (
              <li key={item.entry.id} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      item.kind === "donation"
                        ? "var(--color-series-in)"
                        : "var(--color-series-out)",
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] text-ink">
                    {item.kind === "donation"
                      ? item.entry.donorName
                      : item.entry.title}
                  </p>
                  <p className="tnum text-[0.6875rem] text-ink-faint">{shortDate(item.date)}</p>
                </div>
                <p className="tnum shrink-0 text-[0.8125rem] font-medium text-ink">
                  {item.kind === "donation" ? "+" : "−"}
                  {money(item.entry.amount)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}

function MiniStat({
  label,
  value,
  hint,
  tone = "neutral",
  className = "",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "warn";
  className?: string;
}) {
  return (
    <div className={`px-4 py-3 ${className}`}>
      <p className="text-[0.625rem] font-semibold uppercase tracking-[0.06em] text-ink-faint">
        {label}
      </p>
      <p
        className={`mt-1 text-base font-semibold ${tone === "warn" ? "text-warn" : "text-ink"}`}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[0.6875rem] text-ink-faint">{hint}</p> : null}
    </div>
  );
}
