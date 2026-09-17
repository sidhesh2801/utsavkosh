"use client";

import { useMemo } from "react";
import { expensesByCategory } from "@/lib/finance";
import { humanise } from "@/lib/format";
import type { Expense } from "@/lib/types";
import { Card, SectionTitle } from "./ui";

/**
 * Where the money is going, as proportions and nothing else.
 *
 * The committee does not want the ledger or its figures public yet — five of
 * the nine expenses have no bill against them, and a rupee total invites the
 * question those five cannot answer. But "we are spending it, and here is on
 * what" is the whole reason residents were asked to contribute, and silence
 * answers that worse than a share does.
 *
 * So: shares of total spending, by category. No rupee amounts, no total, no
 * per-entry detail. A resident learns that most of it went on the mandap and
 * almost none on stationery, which is the shape of the answer they want,
 * without learning a single figure.
 *
 * Percentages of an undisclosed total are not reversible into amounts. If the
 * committee ever publishes one expense, the ratios would give up the rest —
 * worth knowing before the ledger is opened piecemeal.
 */
export function SpendingShare({ expenses }: { expenses: Expense[] }) {
  const slices = useMemo(() => {
    const byCategory = expensesByCategory(expenses);
    const total = byCategory.reduce((t, s) => t + s.amount, 0);
    if (!total) return [];
    return byCategory
      .map((s) => ({
        category: s.category,
        share: (s.amount / total) * 100,
        count: s.count,
      }))
      .sort((a, b) => b.share - a.share);
  }, [expenses]);

  if (!slices.length) return null;

  const entries = slices.reduce((t, s) => t + s.count, 0);

  return (
    <Card className="mb-5 p-4">
      <SectionTitle>Where the money is going</SectionTitle>
      <p className="mb-3 text-[0.8125rem] leading-relaxed text-ink-soft">
        The share of spending by kind, across {entries}{" "}
        {entries === 1 ? "entry" : "entries"}. Bills are kept for all of it and
        the committee can show them on request.
      </p>

      <ul className="space-y-2.5">
        {slices.map((s) => (
          <li key={s.category}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[0.8125rem] text-ink">{humanise(s.category)}</span>
              {/* Rounded to whole percent. A decimal invites arithmetic, and
                  there is nothing here meant to be added up. */}
              <span className="tnum shrink-0 text-[0.8125rem] font-medium text-ink-soft">
                {Math.round(s.share)}%
              </span>
            </div>
            <div
              className="mt-1 h-2 overflow-hidden rounded-full bg-surface-sunken"
              role="img"
              aria-label={`${humanise(s.category)}: ${Math.round(s.share)} percent of spending`}
            >
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${Math.max(2, s.share)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
