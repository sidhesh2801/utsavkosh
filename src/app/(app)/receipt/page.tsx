"use client";

import { useMemo, useState } from "react";
import { useLookups, useSociety } from "@/lib/store";
import { amountInWords, receiptLines } from "@/lib/receipt";
import { flatLabel, money, shortDate } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  PageHeader,
  SectionTitle,
} from "@/components/ui";
import type { Donation } from "@/lib/types";

/**
 * Open receipt lookup — no login.
 *
 * A resident who has lost the WhatsApp message can find their receipt by number
 * or by flat, which is the whole point of issuing numbered receipts. Searching
 * by flat also lets a household see everything they've given across festivals.
 */
export default function ReceiptLookupPage() {
  const { data } = useSociety();
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return data.donations
      .filter((d) => {
        const flat = `${d.wing ?? ""}${d.flat ?? ""}`.toLowerCase();
        const flatDash = `${d.wing ?? ""}-${d.flat ?? ""}`.toLowerCase();
        return (
          d.receiptNo.toLowerCase().includes(q) ||
          d.donorName.toLowerCase().includes(q) ||
          flat === q ||
          flatDash === q ||
          (d.flat ?? "").toLowerCase() === q
        );
      })
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  }, [data.donations, query]);

  const total = results.reduce((t, d) => t + d.amount, 0);

  return (
    <div>
      <PageHeader
        title="Find a receipt"
        subtitle="Search by receipt number, your flat, or your name. No sign-in needed."
      />

      <Card className="p-4 sm:p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearched(true);
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <div className="min-w-[14rem] flex-1">
            <Field
              label="Receipt number, flat or name"
              hint={`For example ${data.society.receiptPrefix ?? "WPC"}/2026-27/0042, or A-901`}
            >
              <input
                className="field"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearched(true);
                }}
                placeholder="A-901"
                autoFocus
              />
            </Field>
          </div>
          <Button type="submit" size="lg">
            Search
          </Button>
        </form>
      </Card>

      {searched && query.trim() ? (
        results.length ? (
          <div className="mt-6">
            <SectionTitle>
              {results.length} {results.length === 1 ? "receipt" : "receipts"} · {money(total)} in
              total
            </SectionTitle>
            <div className="space-y-4">
              {results.map((d) => (
                <ReceiptCard key={d.id} donation={d} />
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <EmptyState
              title="Nothing found for that"
              description="Check the receipt number, or try just your flat number. If you were given a paper receipt that isn't here yet, please tell a committee member — that's exactly the kind of gap this register is meant to catch."
            />
          </div>
        )
      ) : null}

      <p className="mt-8 text-xs leading-relaxed text-ink-faint">
        Every contribution the society receives is listed here and in the{" "}
        <a
          href="/funds"
          className="text-brand underline decoration-brand/30 underline-offset-2"
        >
          accounts
        </a>
        , along with every rupee spent. If a figure looks wrong, please raise it with the
        committee.
      </p>
    </div>
  );
}

function ReceiptCard({ donation }: { donation: Donation }) {
  const { data } = useSociety();
  const { activityById, memberById } = useLookups();
  const activity = donation.activityId ? activityById.get(donation.activityId) ?? null : null;
  const receivedBy = memberById.get(donation.recordedBy)?.name ?? "Committee";
  const lines = receiptLines(donation, data.society, activity, receivedBy);

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-dashed border-line-strong px-4 py-3 text-center">
        <p className="text-[0.9375rem] font-semibold text-ink">{data.society.name}</p>
        {data.society.address ? (
          <p className="mt-0.5 text-[0.6875rem] leading-snug text-ink-soft">
            {data.society.address}
          </p>
        ) : null}
        <p className="mt-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-faint">
          Receipt
        </p>
      </div>

      <div className="px-4 py-3.5">
        <dl className="space-y-1.5">
          {lines.map((line) => (
            <div key={line.label} className="flex gap-3 text-[0.8125rem]">
              <dt className="w-28 shrink-0 text-ink-faint">{line.label}</dt>
              <dd
                className={`min-w-0 flex-1 ${
                  line.label === "Amount"
                    ? "tnum text-base font-semibold text-ink"
                    : line.label === "In words"
                      ? "italic text-ink-soft"
                      : "text-ink"
                }`}
              >
                {line.value}
              </dd>
            </div>
          ))}
        </dl>

        {donation.isTenant ? (
          <Badge className="mt-3">Paid by tenant of {flatLabel(donation.wing, donation.flat)}</Badge>
        ) : null}

        {donation.proofSrc ? (
          <div className="mt-3.5">
            <p className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.05em] text-ink-faint">
              Proof on record
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={donation.proofSrc}
              alt={`Payment proof for receipt ${donation.receiptNo}`}
              className="h-40 w-auto rounded-lg border border-line object-contain"
            />
          </div>
        ) : null}
      </div>

      <div className="border-t border-dashed border-line-strong px-4 py-3">
        <p className="text-center text-[0.625rem] leading-relaxed text-ink-faint">
          Computer-generated receipt — no signature required. Issued{" "}
          {shortDate(donation.createdAt)}. This acknowledges an amount received by the society; it
          is not a tax-deductible donation receipt.
        </p>
        <p className="mt-1 text-center text-[0.625rem] text-ink-faint">
          {amountInWords(donation.amount)}
        </p>
      </div>
    </Card>
  );
}
