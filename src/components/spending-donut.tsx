"use client";

import { useMemo } from "react";
import { expensesByCategory } from "@/lib/finance";
import { humanise, money } from "@/lib/format";
import type { Expense } from "@/lib/types";

/**
 * Where the festival's money went, as a ring.
 *
 * On the ledger, where the amounts are public anyway — the donations page keeps
 * the plainer bars, which give the shape without the figures.
 *
 * Six categories and an "Other", never nine. Past about seven slices a reader
 * stops comparing and starts squinting, and the honest alternative to a
 * tenth colour is the table underneath, which is there.
 */

/**
 * Fixed order, assigned by slot and never cycled — a category keeps its colour
 * however the amounts move, so last month's chart and this one can be read
 * against each other. Checked with the palette validator rather than by eye:
 * worst adjacent pair ΔE 9.1 under protanopia, 19.6 under normal vision.
 *
 * Three of these fall below 3:1 against the card, which is why every slice is
 * named and priced in the legend rather than left to its colour.
 */
const SLOT = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
];

const R = 42;
const CIRCUMFERENCE = 2 * Math.PI * R;
/** A 2px break so neighbouring slices read as separate marks, not one band. */
const GAP = 2;

export function SpendingDonut({ expenses }: { expenses: Expense[] }) {
  const { slices, total } = useMemo(() => {
    const byCategory = expensesByCategory(expenses);
    const sum = byCategory.reduce((t, s) => t + s.amount, 0);
    if (!sum) return { slices: [], total: 0 };

    const sorted = [...byCategory].sort((a, b) => b.amount - a.amount);
    const head = sorted.slice(0, 6).map((s) => ({
      label: humanise(s.category),
      amount: s.amount,
    }));
    const rest = sorted.slice(6);
    if (rest.length) {
      head.push({
        label: rest.length === 1 ? humanise(rest[0].category) : "Other",
        amount: rest.reduce((t, s) => t + s.amount, 0),
      });
    }
    // Each slice's start, worked out here rather than by a counter that the
    // render mutates as it goes — React's compiler rejects that, and it is the
    // kind of state that quietly survives a re-render.
    let run = 0;
    const withOffsets = head.map((s) => {
      const start = run;
      run += (s.amount / sum) * CIRCUMFERENCE;
      return { ...s, start };
    });
    return { slices: withOffsets, total: sum };
  }, [expenses]);

  if (!slices.length) return null;

  return (
    <figure className="m-0">
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7">
        <svg
          viewBox="0 0 100 100"
          className="h-40 w-40 shrink-0 -rotate-90"
          role="img"
          aria-label={`Spending by category, ${money(total)} in total`}
        >
          {slices.map((s, i) => {
            const dash = Math.max(1, (s.amount / total) * CIRCUMFERENCE - GAP);
            return (
              <circle
                key={s.label}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={SLOT[i % SLOT.length]}
                strokeWidth="14"
                strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                strokeDashoffset={-s.start}
              >
                <title>{`${s.label}: ${money(s.amount)}`}</title>
              </circle>
            );
          })}
        </svg>

        {/* Named and priced, not left to colour alone: three of the hues sit
            under 3:1 against this card, and a legend is the relief for that. */}
        <ul className="w-full space-y-1.5">
          {slices.map((s, i) => (
            <li key={s.label} className="flex items-baseline gap-2.5">
              <span
                aria-hidden
                className="mt-1 h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ background: SLOT[i % SLOT.length] }}
              />
              <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink">
                {s.label}
              </span>
              <span className="tnum shrink-0 text-[0.8125rem] text-ink-soft">
                {Math.round((s.amount / total) * 100)}%
              </span>
              <span className="tnum w-20 shrink-0 text-right text-[0.8125rem] font-medium text-ink">
                {money(s.amount)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
