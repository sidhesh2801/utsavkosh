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
 * So: shares of total spending, by category, and nothing else. No rupee
 * amounts, no total, no count of entries, not even a line about bills — every
 * sentence around the bars is one more fact given away. A resident learns that
 * most of it went on catering and almost none on printing, which is the shape
 * of the answer they want, without learning a single figure.
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
      }))
      .sort((a, b) => b.share - a.share);
  }, [expenses]);

  if (!slices.length) return null;

  return (
    <Card className="mb-5 p-4">
      <SectionTitle>Where the money is going</SectionTitle>
      {/* No count of entries, no note about bills, no rupees. The bars alone,
          because anything written round them is another fact given away. */}

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
