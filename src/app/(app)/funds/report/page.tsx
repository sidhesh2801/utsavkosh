"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSociety } from "@/lib/store";
import {
  activityFinance,
  donorTotals,
  expensesByCategory,
  fundSummary,
  ledger,
  pending,
} from "@/lib/finance";
import { flatLabel, humanise, methodLabel, money, shortDate } from "@/lib/format";
import { fundSummaryMessage } from "@/lib/messages";
import { Button, Card, SectionTitle } from "@/components/ui";
import { ShareButton } from "@/components/share";

/**
 * The document a treasurer can put in front of a general body meeting: every
 * figure, every line item, and the reconciliation between them. Styled to print
 * cleanly on A4 — the nav chrome and buttons drop out.
 */
export default function ReportPage() {
  const { data } = useSociety();

  const summary = useMemo(() => fundSummary(data.donations, data.expenses), [data]);
  const categories = useMemo(() => expensesByCategory(data.expenses), [data.expenses]);
  const donors = useMemo(() => donorTotals(data.donations), [data.donations]);
  const entries = useMemo(() => ledger(data.donations, data.expenses), [data]);
  const pendingEntries = useMemo(() => pending(data.donations), [data.donations]);

  const perActivity = useMemo(
    () =>
      data.activities
        .map((a) => ({ activity: a, fin: activityFinance(a, data.donations, data.expenses) }))
        .sort((x, y) => y.activity.startsAt.localeCompare(x.activity.startsAt)),
    [data],
  );

  const generalDonations = data.donations.filter((d) => d.activityId === null);
  const generalExpenses = data.expenses.filter((e) => e.activityId === null);

  return (
    <div className="space-y-7">
      <div className="print:hidden">
        <Link
          href="/funds"
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
          Back to funds
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.375rem] font-semibold tracking-[-0.01em] text-ink sm:text-2xl">
            Transparency report
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {data.society.name}
            {data.society.address ? ` · ${data.society.address}` : ""}
          </p>
          <p className="tnum mt-0.5 text-xs text-ink-faint">
            Generated {shortDate(new Date().toISOString())}
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <ShareButton
            size="sm"
            message={fundSummaryMessage(data.society, summary)}
            label="Share summary"
          />
          <Button size="sm" variant="secondary" onClick={() => window.print()}>
            Print / save as PDF
          </Button>
        </div>
      </header>

      {/* Reconciliation */}
      <section>
        <SectionTitle>Statement of account</SectionTitle>
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <tbody>
              <Line label="Total collected (verified)" value={summary.collected} />
              <Line label="Less: total spent" value={-summary.spent} />
              <Line label="Balance in hand" value={summary.balance} strong />
            </tbody>
          </table>
        </Card>
        {pendingEntries.length ? (
          <p className="mt-2 text-xs leading-relaxed text-warn">
            Separately, {money(summary.pendingCollection)} across {pendingEntries.length} entries has
            been collected by volunteers and not yet handed to the treasurer. It is deliberately
            excluded from the balance above and is listed at the end of this report.
          </p>
        ) : null}
      </section>

      {/* Activity-wise */}
      <section>
        <SectionTitle>Activity-wise account</SectionTitle>
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-[0.8125rem]">
            <thead>
              <tr className="border-b border-line text-[0.6875rem] uppercase tracking-[0.05em] text-ink-faint">
                <th scope="col" className="px-4 py-2 font-semibold">Activity</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Budget</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Collected</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Spent</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody>
              {perActivity.map(({ activity, fin }) => (
                <tr key={activity.id} className="border-b border-line last:border-0">
                  <th scope="row" className="px-4 py-2 font-normal">
                    <span className="text-ink">{activity.title}</span>
                    <span className="tnum block text-[0.6875rem] text-ink-faint">
                      {shortDate(activity.startsAt)} · {humanise(activity.status)}
                    </span>
                  </th>
                  <td className="tnum px-3 py-2 text-right text-ink-soft">{money(fin.budget)}</td>
                  <td className="tnum px-3 py-2 text-right">{money(fin.collected)}</td>
                  <td className="tnum px-3 py-2 text-right">{money(fin.spent)}</td>
                  <td
                    className={`tnum px-4 py-2 text-right font-medium ${
                      fin.balance < 0 ? "text-debit" : "text-ink"
                    }`}
                  >
                    {money(fin.balance)}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-line-strong bg-surface-sunken/60">
                <th scope="row" className="px-4 py-2 text-left font-medium text-ink">
                  General society fund
                </th>
                <td className="px-3 py-2 text-right text-ink-faint">—</td>
                <td className="tnum px-3 py-2 text-right">
                  {money(generalDonations.filter((d) => d.status === "verified").reduce((t, d) => t + d.amount, 0))}
                </td>
                <td className="tnum px-3 py-2 text-right">
                  {money(generalExpenses.reduce((t, e) => t + e.amount, 0))}
                </td>
                <td className="tnum px-4 py-2 text-right font-medium">
                  {money(
                    generalDonations
                      .filter((d) => d.status === "verified")
                      .reduce((t, d) => t + d.amount, 0) -
                      generalExpenses.reduce((t, e) => t + e.amount, 0),
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      </section>

      {/* Category-wise */}
      <section>
        <SectionTitle>Expenditure by category</SectionTitle>
        <Card className="overflow-hidden">
          <table className="w-full text-left text-[0.8125rem]">
            <thead>
              <tr className="border-b border-line text-[0.6875rem] uppercase tracking-[0.05em] text-ink-faint">
                <th scope="col" className="px-4 py-2 font-semibold">Category</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Entries</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Amount</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Share</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.category} className="border-b border-line last:border-0">
                  <th scope="row" className="px-4 py-2 text-left font-normal text-ink">
                    {humanise(c.category)}
                  </th>
                  <td className="tnum px-3 py-2 text-right text-ink-soft">{c.count}</td>
                  <td className="tnum px-3 py-2 text-right">{money(c.amount)}</td>
                  <td className="tnum px-4 py-2 text-right text-ink-soft">{c.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      {/* Contributors */}
      <section>
        <SectionTitle>Contributors — {donors.length}</SectionTitle>
        <Card className="overflow-hidden">
          <table className="w-full text-left text-[0.8125rem]">
            <thead>
              <tr className="border-b border-line text-[0.6875rem] uppercase tracking-[0.05em] text-ink-faint">
                <th scope="col" className="px-4 py-2 font-semibold">Contributor</th>
                <th scope="col" className="px-3 py-2 font-semibold">Flat</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Entries</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Total given</th>
              </tr>
            </thead>
            <tbody>
              {donors.map((d) => (
                <tr key={d.donorName} className="border-b border-line last:border-0">
                  <th scope="row" className="px-4 py-2 text-left font-normal text-ink">
                    {d.donorName}
                  </th>
                  <td className="tnum px-3 py-2 text-ink-soft">{flatLabel(d.wing, d.flat)}</td>
                  <td className="tnum px-3 py-2 text-right text-ink-soft">{d.count}</td>
                  <td className="tnum px-4 py-2 text-right font-medium">{money(d.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      {/* Pending handovers */}
      {pendingEntries.length ? (
        <section>
          <SectionTitle>Collected but not yet handed over</SectionTitle>
          <Card className="overflow-hidden">
            <table className="w-full text-left text-[0.8125rem]">
              <thead>
                <tr className="border-b border-line text-[0.6875rem] uppercase tracking-[0.05em] text-ink-faint">
                  <th scope="col" className="px-4 py-2 font-semibold">Date</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Contributor</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Collected by</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {pendingEntries.map((d) => {
                  const collector = data.members.find((m) => m.id === d.recordedBy);
                  return (
                    <tr key={d.id} className="border-b border-line last:border-0">
                      <td className="tnum px-4 py-2 text-ink-soft">{shortDate(d.receivedAt)}</td>
                      <td className="px-3 py-2 text-ink">
                        {d.donorName}
                        <span className="tnum ml-1.5 text-[0.6875rem] text-ink-faint">
                          {flatLabel(d.wing, d.flat)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-ink-soft">{collector?.name ?? "—"}</td>
                      <td className="tnum px-4 py-2 text-right font-medium text-warn">
                        {money(d.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </section>
      ) : null}

      {/* Full ledger */}
      <section>
        <SectionTitle>Complete ledger — {entries.length} entries</SectionTitle>
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-[0.8125rem]">
            <thead>
              <tr className="border-b border-line text-[0.6875rem] uppercase tracking-[0.05em] text-ink-faint">
                <th scope="col" className="px-4 py-2 font-semibold">Date</th>
                <th scope="col" className="px-3 py-2 font-semibold">Particulars</th>
                <th scope="col" className="px-3 py-2 font-semibold">Mode / reference</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">In</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Out</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((item) => (
                <tr key={item.entry.id} className="border-b border-line last:border-0">
                  <td className="tnum whitespace-nowrap px-4 py-2 text-ink-soft">
                    {shortDate(item.date)}
                  </td>
                  <td className="px-3 py-2">
                    {item.kind === "donation" ? (
                      <>
                        <span className="text-ink">{item.entry.donorName}</span>
                        <span className="tnum ml-1.5 text-[0.6875rem] text-ink-faint">
                          {flatLabel(item.entry.wing, item.entry.flat)}
                        </span>
                        {item.entry.status === "pending" ? (
                          <span className="ml-1.5 text-[0.6875rem] font-medium text-warn">
                            (pending handover)
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <span className="text-ink">{item.entry.title}</span>
                        {item.entry.vendor ? (
                          <span className="block text-[0.6875rem] text-ink-faint">
                            {item.entry.vendor}
                          </span>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[0.75rem] text-ink-soft">
                    {methodLabel(item.entry.method)}
                    {item.kind === "donation" && item.entry.reference ? (
                      <span className="tnum block text-[0.6875rem] text-ink-faint">
                        {item.entry.reference}
                      </span>
                    ) : null}
                    {item.kind === "expense" && item.entry.billNo ? (
                      <span className="tnum block text-[0.6875rem] text-ink-faint">
                        Bill {item.entry.billNo}
                      </span>
                    ) : null}
                  </td>
                  <td className="tnum px-3 py-2 text-right">
                    {item.kind === "donation" ? money(item.entry.amount) : ""}
                  </td>
                  <td className="tnum px-4 py-2 text-right">
                    {item.kind === "expense" ? money(item.entry.amount) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <p className="text-xs leading-relaxed text-ink-faint">
        Any resident may ask the committee to see the original bill against any entry above. If a
        figure here looks wrong, please raise it — that is exactly what this register is for.
      </p>
    </div>
  );
}

function Line({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <tr className={`border-b border-line last:border-0 ${strong ? "bg-brand-soft/50" : ""}`}>
      <th
        scope="row"
        className={`px-4 py-2.5 text-left font-normal ${strong ? "font-semibold text-brand-ink" : "text-ink-soft"}`}
      >
        {label}
      </th>
      <td
        className={`tnum px-4 py-2.5 text-right ${
          strong ? "text-base font-semibold text-brand-ink" : "font-medium text-ink"
        }`}
      >
        {money(value)}
      </td>
    </tr>
  );
}
