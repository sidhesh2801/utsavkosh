"use client";

import { useState } from "react";
import { money, moneyShort } from "@/lib/format";
import { humanise } from "@/lib/format";
import type { CategorySlice, MonthFlow } from "@/lib/finance";

/**
 * Charts follow a few fixed rules so they read as one system:
 *  - bars capped at 24px with a 4px rounded data-end, square at the baseline
 *  - a 2px surface gap separates touching bars; no borders drawn around marks
 *  - gridlines are solid hairlines one step off the surface, never dashed
 *  - two series always get a legend; labels are selective, never one per bar
 *  - a table view mirrors every chart, so no value is reachable only by hover
 */

function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5 text-xs text-ink-soft">
          <span
            aria-hidden
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: i.color }}
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

function TableToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="text-xs font-medium text-ink-soft underline decoration-line-strong underline-offset-2 transition-colors hover:text-ink"
    >
      {open ? "Hide table" : "Show as table"}
    </button>
  );
}

/** Rounds up to a clean axis maximum: 1,000 / 2,500 / 50,000 and so on. */
function axisMax(value: number): number {
  if (value <= 0) return 1000;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) {
    if (value <= step * magnitude) return step * magnitude;
  }
  return 10 * magnitude;
}

/* ------------------------------------------------- money in vs out, monthly */

export function MonthlyFlowChart({ months }: { months: MonthFlow[] }) {
  const [showTable, setShowTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  const peak = Math.max(...months.map((m) => Math.max(m.collected, m.spent)), 0);
  const max = axisMax(peak);
  const ticks = [0, max / 2, max];

  return (
    <figure className="m-0">
      <figcaption className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Legend
          items={[
            { label: "Collected", color: "var(--color-series-in)" },
            { label: "Spent", color: "var(--color-series-out)" },
          ]}
        />
        <TableToggle open={showTable} onToggle={() => setShowTable((v) => !v)} />
      </figcaption>

      {/* Height covers the plot plus the x-axis band, so the card never scrolls. */}
      <div className="relative flex gap-2">
        <div className="flex w-11 shrink-0 flex-col justify-between pb-6 text-right">
          {[...ticks].reverse().map((t) => (
            <span key={t} className="tnum text-[0.625rem] leading-none text-ink-faint">
              {moneyShort(t)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Solid hairline gridlines, recessive */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40">
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute inset-x-0 border-t border-grid"
                style={{ bottom: `${(t / max) * 100}%` }}
              />
            ))}
          </div>

          <ul className="relative flex h-40 items-end gap-[3px]">
            {months.map((m, i) => {
              const active = hover === i;
              return (
                <li
                  key={m.key}
                  className="relative flex h-full min-w-0 flex-1 items-end justify-center"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  {/* Generous hit target covering the whole month band */}
                  <button
                    type="button"
                    className="absolute inset-0 z-10 cursor-default"
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    aria-label={`${m.label}: collected ${money(m.collected)}, spent ${money(m.spent)}`}
                  />
                  {/* 2px surface gap between the touching pair, no strokes */}
                  <div className="flex h-full w-full items-end justify-center gap-[2px]">
                    <Column value={m.collected} max={max} color="var(--color-series-in)" active={active} />
                    <Column value={m.spent} max={max} color="var(--color-series-out)" active={active} />
                  </div>

                  {active && (m.collected > 0 || m.spent > 0) ? (
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-[0.6875rem] leading-tight text-white shadow-lg">
                      <span className="block font-semibold">{m.label}</span>
                      <span className="tnum block">In {money(m.collected)}</span>
                      <span className="tnum block">Out {money(m.spent)}</span>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <div className="mt-1.5 flex gap-[3px]">
            {months.map((m) => (
              <span
                key={m.key}
                className="min-w-0 flex-1 text-center text-[0.625rem] text-ink-faint"
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {showTable ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-[0.8125rem]">
            <thead>
              <tr className="border-b border-line text-[0.6875rem] uppercase tracking-[0.05em] text-ink-faint">
                <th scope="col" className="py-1.5 pr-3 font-semibold">Month</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-semibold">Collected</th>
                <th scope="col" className="py-1.5 text-right font-semibold">Spent</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.key} className="border-b border-line last:border-0">
                  <th scope="row" className="py-1.5 pr-3 font-normal text-ink-soft">{m.label}</th>
                  <td className="tnum py-1.5 pr-3 text-right">{money(m.collected)}</td>
                  <td className="tnum py-1.5 text-right">{money(m.spent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </figure>
  );
}

function Column({
  value,
  max,
  color,
  active,
}: {
  value: number;
  max: number;
  color: string;
  active: boolean;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div
      // Capped width, rounded data-end, square at the baseline.
      className="w-full max-w-[11px] rounded-t-[4px] transition-[height,opacity] duration-500"
      style={{
        height: `${Math.max(pct, value > 0 ? 1.5 : 0)}%`,
        backgroundColor: color,
        opacity: active ? 1 : 0.9,
      }}
    />
  );
}

/* ------------------------------------------------------ expenses by category */

/**
 * One series, so every bar wears the same hue — colouring bars darker-where-bigger
 * would double-encode length as colour and tell the reader nothing new. Ranked
 * descending, value at the tip, no legend (the heading names what's plotted).
 */
export function CategoryBars({
  slices,
  emptyLabel = "No spending recorded yet.",
}: {
  slices: CategorySlice[];
  emptyLabel?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  const max = Math.max(...slices.map((s) => s.amount), 0);

  if (!slices.length) {
    return <p className="py-6 text-center text-sm text-ink-soft">{emptyLabel}</p>;
  }

  return (
    <figure className="m-0">
      <figcaption className="mb-3 flex justify-end">
        <TableToggle open={showTable} onToggle={() => setShowTable((v) => !v)} />
      </figcaption>

      <ul className="space-y-2.5">
        {slices.map((s) => (
          <li key={s.category}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-[0.8125rem] text-ink">{humanise(s.category)}</span>
              <span className="tnum shrink-0 text-[0.8125rem] font-medium text-ink">
                {money(s.amount)}
                <span className="ml-1.5 text-xs font-normal text-ink-faint">{s.pct}%</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-series-out-wash">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${max > 0 ? (s.amount / max) * 100 : 0}%`,
                  backgroundColor: "var(--color-series-out)",
                }}
              />
            </div>
          </li>
        ))}
      </ul>

      {showTable ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-[0.8125rem]">
            <thead>
              <tr className="border-b border-line text-[0.6875rem] uppercase tracking-[0.05em] text-ink-faint">
                <th scope="col" className="py-1.5 pr-3 font-semibold">Category</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-semibold">Entries</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-semibold">Amount</th>
                <th scope="col" className="py-1.5 text-right font-semibold">Share</th>
              </tr>
            </thead>
            <tbody>
              {slices.map((s) => (
                <tr key={s.category} className="border-b border-line last:border-0">
                  <th scope="row" className="py-1.5 pr-3 font-normal text-ink-soft">
                    {humanise(s.category)}
                  </th>
                  <td className="tnum py-1.5 pr-3 text-right">{s.count}</td>
                  <td className="tnum py-1.5 pr-3 text-right">{money(s.amount)}</td>
                  <td className="tnum py-1.5 text-right">{s.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </figure>
  );
}
