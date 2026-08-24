"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { csvName, downloadCsv, toCsv } from "@/lib/csv";
import { useSociety } from "@/lib/store";
import { Button, Card, Field, SectionTitle } from "./ui";

interface Coupon {
  code: string;
  name: string;
  flat: string;
  mobile: string;
  members: number;
  served: number;
  remaining: number;
  walkIn: boolean;
  at: string;
}

type Filter = "all" | "waiting" | "partly" | "done";

/**
 * Every coupon registered, so the committee can see how many families are
 * coming and how many people that adds up to — which is the number the kitchen
 * actually needs.
 *
 * Searchable by flat, because the question at a counter is always "has N-1802
 * already eaten", never "show me everyone".
 */
export function CouponList({ refreshKey }: { refreshKey?: number }) {
  const { data } = useSociety();
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    const res = await fetch("/api/coupons/list");
    if (!res.ok) return;
    const d = await res.json();
    setCoupons(d.coupons ?? []);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load, refreshKey]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (coupons ?? []).filter((c) => {
      if (filter === "waiting" && c.served !== 0) return false;
      if (filter === "partly" && !(c.served > 0 && c.remaining > 0)) return false;
      if (filter === "done" && c.remaining !== 0) return false;
      if (!q) return true;
      return (
        c.flat.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q)
      );
    });
  }, [coupons, query, filter]);

  const people = shown.reduce((t, c) => t + c.members, 0);
  const eaten = shown.reduce((t, c) => t + c.served, 0);

  if (!coupons) return null;

  return (
    <Card className="overflow-hidden">
      <div className="px-4 pt-4">
        <SectionTitle
          action={
            <Button
              size="sm"
              variant="secondary"
              disabled={!shown.length}
              onClick={() =>
                downloadCsv(
                  csvName(data.society.name, "food-coupons"),
                  toCsv(
                    ["Code", "Flat", "Name", "Mobile", "People", "Served", "Left", "Issued at counter", "Registered"],
                    shown.map((c) => [
                      c.code,
                      c.flat,
                      c.name,
                      c.mobile,
                      c.members,
                      c.served,
                      c.remaining,
                      c.walkIn ? "yes" : "",
                      new Date(c.at).toLocaleString("en-IN"),
                    ]),
                  ),
                )
              }
            >
              Download CSV
            </Button>
          }
        >
          {coupons.length} {coupons.length === 1 ? "family" : "families"} registered
        </SectionTitle>
      </div>

      <div className="flex flex-wrap items-end gap-2 px-4 pb-3">
        <div className="min-w-[11rem] flex-1">
          <Field label="Find a flat">
            <input
              className="field"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="N-1802, name or code"
            />
          </Field>
        </div>
        <Field label="Show">
          <select
            className="field w-auto"
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
          >
            <option value="all">Everyone</option>
            <option value="waiting">Not yet eaten</option>
            <option value="partly">Partly served</option>
            <option value="done">Fully served</option>
          </select>
        </Field>
      </div>

      <p className="tnum px-4 pb-3 text-[0.8125rem] text-ink-soft">
        <span className="font-medium text-ink">{shown.length}</span> shown ·{" "}
        <span className="font-medium text-ink">{people}</span> people ·{" "}
        <span className="font-medium text-ink">{eaten}</span> eaten
      </p>

      {shown.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-[0.8125rem]">
            <thead>
              <tr className="border-b border-line text-[0.6875rem] uppercase tracking-[0.05em] text-ink-faint">
                <th className="px-4 py-2.5 font-semibold">Flat</th>
                <th className="px-4 py-2.5 font-semibold">Name</th>
                <th className="px-4 py-2.5 font-semibold">Code</th>
                <th className="px-4 py-2.5 text-right font-semibold">People</th>
                <th className="px-4 py-2.5 text-right font-semibold">Eaten</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((c) => (
                <tr key={c.code}>
                  <td className="tnum whitespace-nowrap px-4 py-2 font-medium text-ink">
                    {c.flat || "—"}
                  </td>
                  <td className="px-4 py-2 text-ink">
                    {c.name}
                    {c.walkIn ? (
                      <span className="ml-1.5 text-[0.6875rem] text-ink-faint">at counter</span>
                    ) : null}
                  </td>
                  <td className="tnum px-4 py-2 text-ink-faint">{c.code}</td>
                  <td className="tnum px-4 py-2 text-right text-ink">{c.members}</td>
                  <td className="tnum px-4 py-2 text-right text-ink">{c.served}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {c.remaining === 0 ? (
                      <span className="text-credit">Fully served</span>
                    ) : c.served > 0 ? (
                      <span className="text-warn">{c.remaining} left</span>
                    ) : (
                      <span className="text-ink-faint">Not yet</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 pb-4 text-sm text-ink-soft">
          {coupons.length ? "Nothing matches that." : "Nobody has registered yet."}
        </p>
      )}
    </Card>
  );
}
