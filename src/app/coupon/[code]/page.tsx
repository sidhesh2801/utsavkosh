"use client";

import { use, useCallback, useEffect, useState } from "react";

interface Coupon {
  code: string;
  name: string;
  flat: string;
  members: number;
  served: number;
  remaining: number;
  walkIn: boolean;
}

/**
 * What the QR opens.
 *
 * Deliberately outside the app shell: at a serving counter this is the whole
 * screen, read at arm's length, and a nav bar is only something to mis-tap.
 *
 * A resident opening their own coupon sees the balance. A volunteer who is
 * signed in also sees the serve buttons, so the same link works for both and
 * there is nothing to explain.
 */
export default function CouponPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [committee, setCommittee] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/coupons/${code}`);
    const payload = await res.json();
    if (!res.ok) setError(payload.error ?? "Could not load the coupon.");
    else setCoupon(payload.coupon);
  }, [code]);

  useEffect(() => {
    // Queued, not synchronous: setting state inside an effect body makes React
    // render twice before the page has even shown anything.
    const t = setTimeout(() => {
      void load();
      fetch("/api/session")
        .then((r) => r.json())
        .then((d) => setCommittee(Boolean(d.authenticated)))
        .catch(() => setCommittee(false));
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function serve(count: number) {
    setBusy(true);
    setMessage(null);
    setError(null);
    const res = await fetch(`/api/coupons/${code}/serve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count }),
    });
    const payload = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(payload.error ?? "Could not record it.");
      await load();
      return;
    }
    setMessage(`Served ${count}. ${payload.remaining} left.`);
    await load();
  }

  if (error && !coupon) {
    return (
      <Shell>
        <p className="text-center text-lg font-medium text-debit">{error}</p>
        <p className="mt-2 text-center text-sm text-ink-soft">
          Check the code, or ask them to open their coupon link again.
        </p>
      </Shell>
    );
  }

  if (!coupon) {
    return (
      <Shell>
        <p className="text-center text-ink-soft">Loading…</p>
      </Shell>
    );
  }

  const done = coupon.remaining === 0;

  return (
    <Shell>
      {/* Big, because this is read across a counter, quickly. */}
      <p className="tnum text-center text-sm tracking-[0.12em] text-ink-faint">{coupon.code}</p>
      <h1 className="mt-1 text-center text-2xl font-semibold text-ink">{coupon.name}</h1>
      {coupon.flat ? (
        <p className="tnum mt-0.5 text-center text-base text-ink-soft">{coupon.flat}</p>
      ) : null}
      {coupon.walkIn ? (
        <p className="mt-1 text-center text-xs text-ink-faint">Issued at the counter</p>
      ) : null}

      <div
        className={`mt-5 rounded-2xl px-5 py-6 text-center ${
          done ? "bg-surface-sunken" : "bg-brand-soft"
        }`}
      >
        {done ? (
          <>
            <p className="text-xl font-semibold text-ink">Fully served</p>
            <p className="tnum mt-1 text-sm text-ink-soft">
              All {coupon.members} have eaten
            </p>
          </>
        ) : (
          <>
            <p className="tnum text-5xl font-semibold leading-none text-brand-ink">
              {coupon.remaining}
            </p>
            <p className="mt-2 text-sm text-brand-ink/80">
              still to eat, of {coupon.members}
            </p>
          </>
        )}
      </div>

      {message ? (
        <p className="mt-4 rounded-lg bg-credit-soft px-3 py-2.5 text-center text-sm font-medium text-credit">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-lg bg-warn-soft px-3 py-2.5 text-center text-sm font-medium text-warn">
          {error}
        </p>
      ) : null}

      {committee ? (
        done ? null : (
          <div className="mt-5">
            <p className="mb-2 text-center text-sm text-ink-soft">How many are eating now?</p>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: Math.min(coupon.remaining, 6) }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={busy}
                  onClick={() => serve(n)}
                  className="tnum rounded-xl bg-brand py-5 text-2xl font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-50"
                >
                  {n}
                </button>
              ))}
            </div>
            {coupon.remaining > 6 ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => serve(coupon.remaining)}
                className="mt-2 w-full rounded-xl border border-line-strong py-3 text-sm font-medium text-ink"
              >
                All {coupon.remaining}
              </button>
            ) : null}
          </div>
        )
      ) : (
        <p className="mt-5 text-center text-xs leading-relaxed text-ink-faint">
          Show this screen at the food counter.
        </p>
      )}

      <div className="mt-6 text-center">
        <a
          href="/food-counter"
          className="text-[0.8125rem] text-brand underline decoration-brand/30 underline-offset-2"
        >
          {committee ? "Back to the counter" : "Committee sign in"}
        </a>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-8">
      {children}
    </main>
  );
}
