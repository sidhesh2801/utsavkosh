"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSociety } from "@/lib/store";
import { Button, Card, EmptyState, Field, PageHeader, SectionTitle, useToast } from "@/components/ui";
import { useCommitteeSession } from "@/components/ledger-admin";
import { ScanButton } from "@/components/coupon-scanner";

interface Summary {
  coupons: number;
  people_registered: number;
  people_served: number;
  coupons_started: number;
  coupons_complete: number;
  walk_ins: number;
}

interface Serving {
  count: number;
  at: string;
  name: string;
  flat: string;
  code: string;
}

/**
 * The serving counter: how many have eaten, how the queue is moving, and a way
 * to issue a coupon to someone standing there without one.
 *
 * Refreshes itself every ten seconds. Several volunteers will have this open
 * at once and none of them will think to reload.
 */
export default function FoodCounterPage() {
  const committee = useCommitteeSession();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recent, setRecent] = useState<Serving[]>([]);
  const [perHour, setPerHour] = useState<{ hour: string; people: number }[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/coupons/stats");
    if (!res.ok) return;
    const d = await res.json();
    setSummary(d.summary);
    setRecent(d.recent ?? []);
    setPerHour(d.perHour ?? []);
  }, []);

  useEffect(() => {
    if (!committee.authenticated) return;
    // Queued rather than called straight away: setting state synchronously
    // inside an effect makes React render twice for no reason.
    const first = setTimeout(load, 0);
    const timer = setInterval(load, 10_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [committee.authenticated, load]);

  if (committee.checked && !committee.authenticated) {
    return (
      <EmptyState
        title="Committee only"
        description="Sign in with the same password as the receipt generator to run the counter."
        action={
          <a
            href="/generator-login?next=/food-counter"
            className="inline-flex items-center rounded-[10px] bg-brand px-4 py-2.5 text-[0.8125rem] font-medium text-white"
          >
            Sign in
          </a>
        }
      />
    );
  }

  const registered = summary?.people_registered ?? 0;
  const served = summary?.people_served ?? 0;
  const waiting = Math.max(0, registered - served);
  const busiest = perHour.reduce((m, h) => Math.max(m, h.people), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Food counter"
        subtitle="Point your phone camera at a coupon QR to serve. This page keeps itself up to date."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Served" value={served} tone="credit" />
        <Tile label="Still to eat" value={waiting} tone={waiting > 0 ? "brand" : "neutral"} />
        <Tile label="Coupons" value={summary?.coupons ?? 0} />
        <Tile label="Issued at counter" value={summary?.walk_ins ?? 0} />
      </div>

      {/* The main action at a counter, so it sits above everything else. */}
      <ScanButton onServed={load} />

      <Card className="p-4">
        <SectionTitle>Issue a coupon here</SectionTitle>
        <p className="mb-3 text-[0.8125rem] leading-relaxed text-ink-soft">
          For someone at the counter without one — a flat phone, a guest. Counted the same as any
          other, so the headcount stays true.
        </p>
        <WalkInForm />
      </Card>

      {perHour.length ? (
        <Card className="p-4">
          <SectionTitle>People served, by hour</SectionTitle>
          <ul className="space-y-1.5">
            {perHour.map((h) => (
              <li key={h.hour} className="flex items-center gap-3">
                <span className="tnum w-12 shrink-0 text-xs text-ink-faint">
                  {new Date(`${h.hour}:00:00Z`).toLocaleTimeString("en-IN", {
                    hour: "numeric",
                    hour12: true,
                  })}
                </span>
                <span className="h-4 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                  <span
                    className="block h-full rounded-full bg-brand"
                    style={{ width: `${busiest ? (h.people / busiest) * 100 : 0}%` }}
                  />
                </span>
                <span className="tnum w-8 shrink-0 text-right text-xs font-medium text-ink">
                  {h.people}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <div className="px-4 pt-4">
          <SectionTitle>Just served</SectionTitle>
        </div>
        {recent.length ? (
          <ul className="divide-y divide-line">
            {recent.map((r, i) => (
              <li key={`${r.code}-${r.at}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                <span className="tnum grid h-9 w-9 shrink-0 place-items-center rounded-full bg-credit-soft text-sm font-semibold text-credit">
                  {r.count}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.8125rem] font-medium text-ink">
                    {r.name}
                  </span>
                  <span className="tnum block text-xs text-ink-faint">
                    {r.flat || r.code}
                  </span>
                </span>
                <span className="tnum shrink-0 text-xs text-ink-faint">
                  {new Date(r.at).toLocaleTimeString("en-IN", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 pb-4 text-sm text-ink-soft">Nobody served yet.</p>
        )}
      </Card>
    </div>
  );
}

function Tile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "credit" | "brand" | "neutral";
}) {
  const colour =
    tone === "credit" ? "text-credit" : tone === "brand" ? "text-brand-ink" : "text-ink";
  return (
    <Card className="px-4 py-3.5">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-ink-faint">
        {label}
      </p>
      <p className={`tnum mt-1 text-2xl font-semibold ${colour}`}>{value}</p>
    </Card>
  );
}

function WalkInForm() {
  const router = useRouter();
  const { data } = useSociety();
  const toast = useToast();
  const [name, setName] = useState("");
  const [wing, setWing] = useState("");
  const [flat, setFlat] = useState("");
  const [members, setMembers] = useState("2");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, wing, flat, members: Number(members), walkIn: true }),
    });
    const payload = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast(payload.error ?? "Could not issue it.", "error");
      return;
    }
    // Straight to the coupon so the volunteer can serve them immediately.
    router.push(`/coupon/${payload.coupon.code}`);
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-4">
      <Field label="Name" required>
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Name"
        />
      </Field>
      <Field label="Tower">
        {data.society.wings.length ? (
          <select className="field" value={wing} onChange={(e) => setWing(e.target.value)}>
            <option value="">—</option>
            {data.society.wings.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        ) : (
          <input className="field" value={wing} onChange={(e) => setWing(e.target.value)} />
        )}
      </Field>
      <Field label="Flat">
        <input
          className="field tnum"
          value={flat}
          onChange={(e) => setFlat(e.target.value.replace(/\D/g, "").slice(0, 4))}
          inputMode="numeric"
          maxLength={4}
          placeholder="1305"
        />
      </Field>
      <Field label="No. of persons" required>
        <div className="flex gap-2">
          <input
            className="field tnum"
            type="number"
            min={1}
            max={30}
            value={members}
            onChange={(e) => setMembers(e.target.value)}
            required
          />
          <Button type="submit" disabled={busy}>
            {busy ? "…" : "Issue"}
          </Button>
        </div>
      </Field>
    </form>
  );
}
