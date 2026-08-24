"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSociety } from "@/lib/store";
import { fundSummary } from "@/lib/finance";
import { money } from "@/lib/format";
import { Card } from "@/components/ui";

/**
 * The home page: what the society holds, and the three things you can do.
 *
 * Deliberately short. Two of the three doors are open to every resident; only
 * writing a receipt asks for a password, and that is said on the card rather
 * than discovered by being turned away.
 */
export default function HomePage() {
  const { data } = useSociety();
  const summary = useMemo(() => fundSummary(data.donations, data.expenses), [data]);

  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm text-ink-soft">{data.society.name}</p>
        <h1 className="mt-0.5 text-[1.375rem] font-semibold tracking-[-0.01em] text-ink sm:text-2xl">
          Festival accounts, open to everyone
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
          Every rupee collected and every rupee spent is listed here. No sign-in needed to look.
        </p>
      </div>

      {/* The one figure that matters, before anything else. */}
      <Card className="overflow-hidden">
        <div className="border-b border-line bg-brand-soft px-5 py-5">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-brand-ink/70">
            Balance in hand
          </p>
          <p className="tnum mt-1 text-[2.75rem] font-semibold leading-none tracking-[-0.02em] text-brand-ink">
            {money(summary.balance)}
          </p>
          <p className="tnum mt-2 text-[0.8125rem] leading-snug text-brand-ink/80">
            {money(summary.collected)} collected · {money(summary.spent)} spent
          </p>
        </div>
        {summary.pendingCollection > 0 ? (
          <div className="border-b border-line px-5 py-3">
            <p className="tnum text-[0.8125rem] text-warn">
              {money(summary.pendingCollection)} is recorded but not yet with the treasurer, so it
              is not counted above.
            </p>
          </div>
        ) : null}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Option
          href="/donations"
          title="Donations"
          description="Who contributed, how much, and which flat."
          meta={`${summary.donationCount} ${summary.donationCount === 1 ? "entry" : "entries"}`}
          icon={
            <>
              <path d="M3 6h18v13H3z" />
              <path d="M7 10.5h5M7 14h8" />
            </>
          }
        />
        <Option
          href="/ledger"
          title="Ledger"
          description="Every expense with vendor and bill number."
          meta={`${summary.expenseCount} ${summary.expenseCount === 1 ? "entry" : "entries"}`}
          icon={
            <>
              <path d="M5 3h14v18H5z" />
              <path d="M9 7.5h6M9 12h6M9 16.5h3" />
            </>
          }
        />
        <Option
          href="/food-coupon"
          title="Food coupon"
          description="Register your flat and get a QR for the counter."
          meta="No login needed"
          icon={
            <>
              <path d="M4 4v6a3 3 0 0 0 6 0V4M7 10v10" />
              <path d="M17 4c-1.5 2-2 4-2 6a2 2 0 0 0 2 2h1V4z" />
              <path d="M17.5 12v8" />
            </>
          }
        />
        <Option
          href="/receipt-generator.html"
          external
          title="Write a receipt"
          description="For the committee and collection volunteers."
          meta="Password needed"
          icon={
            <>
              <path d="M4 5.5h11l5 5V21H4z" />
              <path d="M15 5.5V11h5M8 15h8" />
            </>
          }
        />
      </div>
    </div>
  );
}

function Option({
  href,
  title,
  description,
  meta,
  icon,
  external,
}: {
  href: string;
  title: string;
  description: string;
  meta: string;
  icon: React.ReactNode;
  external?: boolean;
}) {
  const inner = (
    <>
      <span
        aria-hidden
        className="grid h-10 w-10 place-items-center rounded-[10px] bg-brand-soft text-brand-ink"
      >
        <svg
          width="21"
          height="21"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {icon}
        </svg>
      </span>
      <span className="mt-3 block text-[0.9375rem] font-semibold text-ink">{title}</span>
      <span className="mt-1 block text-[0.8125rem] leading-snug text-ink-soft">{description}</span>
      <span className="tnum mt-2 block text-[0.6875rem] text-ink-faint">{meta}</span>
    </>
  );

  const className =
    "card block p-4 transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md";

  // The generator is a static file behind middleware, so it needs a full load.
  return external ? (
    <a href={href} className={className}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}
