"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useSociety } from "@/lib/store";
import { Button, Card, Field, PageHeader } from "@/components/ui";
import { useCommitteeSession } from "@/components/ledger-admin";

interface Coupon {
  code: string;
  name: string;
  flat: string;
  members: number;
  served: number;
  remaining: number;
}

/**
 * Registering for a food coupon. Open to any resident with the link.
 *
 * The QR encodes a URL, not data — so at the counter a volunteer points their
 * ordinary phone camera at it and the coupon page opens. No scanner app, no
 * camera permissions, nothing to install on a hundred phones.
 */
export default function FoodCouponPage() {
  const { data } = useSociety();
  const committee = useCommitteeSession();

  const [name, setName] = useState("");
  const [wing, setWing] = useState("");
  const [flat, setFlat] = useState("");
  const [mobile, setMobile] = useState("");
  const [members, setMembers] = useState("2");
  const [cap, setCap] = useState(5);
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [already, setAlready] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      fetch("/api/coupons")
        .then((r) => r.json())
        .then((d) => setCap(Number(d.maxMembers) || 5))
        .catch(() => setCap(5));
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, wing, flat, mobile, members: Number(members) }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "Could not create the coupon.");
        setBusy(false);
        return;
      }
      setCoupon(payload.coupon);
      setAlready(Boolean(payload.alreadyRegistered));
    } catch {
      setError("Couldn't reach the server. Check your connection.");
    }
    setBusy(false);
  }

  if (coupon) {
    return <CouponIssued coupon={coupon} already={already} society={data.society.name} />;
  }

  return (
    <div>
      <PageHeader
        title="Food coupon"
        subtitle="Register your flat once. Show the QR at the counter — one coupon covers your whole family."
      />

      <Card className="p-4 sm:p-5">
        <form onSubmit={submit} className="space-y-3.5">
          <Field label="Your name" required>
            <input
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Anup Deo"
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Tower" required>
              {data.society.wings.length ? (
                <select className="field" value={wing} onChange={(e) => setWing(e.target.value)} required>
                  <option value="">—</option>
                  {data.society.wings.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              ) : (
                <input className="field" value={wing} onChange={(e) => setWing(e.target.value)} required placeholder="N" />
              )}
            </Field>
            <Field label="Flat no." required>
              <input
                className="field tnum"
                value={flat}
                onChange={(e) => setFlat(e.target.value)}
                required
                inputMode="numeric"
                placeholder="130"
              />
            </Field>
            <Field label="No. of persons" required>
              {/* A dropdown, not a number box: it can only offer valid choices,
                  so nobody types 20 and is refused after filling the form. */}
              <select
                className="field tnum"
                value={members}
                onChange={(e) => setMembers(e.target.value)}
                required
              >
                {Array.from({ length: cap }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Mobile" hint="So the committee can reach you if there's a problem.">
            <input
              className="field tnum"
              type="tel"
              inputMode="numeric"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />
          </Field>

          {error ? (
            <p role="alert" className="rounded-lg bg-debit-soft px-3 py-2.5 text-[0.8125rem] leading-snug text-debit">
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Creating…" : "Get my coupon"}
          </Button>
        </form>
      </Card>

      <p className="mt-4 text-xs leading-relaxed text-ink-faint">
        One coupon per flat, for up to {cap} people. Registering again shows you the same coupon
        rather than issuing a second one. For a larger family, please ask a committee member.
      </p>

      {committee.authenticated ? (
        <p className="mt-4 text-[0.8125rem]">
          <a href="/food-counter" className="text-brand underline decoration-brand/30 underline-offset-2">
            Open the serving counter →
          </a>
        </p>
      ) : null}
    </div>
  );
}

function CouponIssued({
  coupon,
  already,
  society,
}: {
  coupon: Coupon;
  already: boolean;
  society: string;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const url = typeof window !== "undefined" ? `${window.location.origin}/coupon/${coupon.code}` : "";

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { width: 640, margin: 1, errorCorrectionLevel: "M" })
      .then(setQr)
      .catch(() => setQr(null));
  }, [url]);

  return (
    <div>
      <PageHeader
        title={already ? "You already have a coupon" : "Your food coupon"}
        subtitle="Screenshot this, or add the page to your home screen. Show it at the counter."
      />

      <Card className="p-5 text-center">
        <p className="text-sm font-medium text-ink">{society}</p>
        <p className="tnum mt-1 text-3xl font-semibold tracking-[0.08em] text-brand-ink">
          {coupon.code}
        </p>

        {qr ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={qr}
            alt={`QR code for coupon ${coupon.code}`}
            className="mx-auto mt-4 h-auto w-[min(70vw,17rem)] rounded-xl border border-line bg-white p-2"
          />
        ) : (
          <p className="mt-4 text-sm text-ink-soft">Preparing the code…</p>
        )}

        <p className="mt-4 text-base font-semibold text-ink">{coupon.name}</p>
        <p className="tnum text-sm text-ink-soft">{coupon.flat}</p>
        <p className="tnum mt-3 text-sm text-ink">
          Covers <span className="font-semibold">{coupon.members}</span>{" "}
          {coupon.members === 1 ? "person" : "people"}
        </p>
        {coupon.served > 0 ? (
          <p className="tnum mt-1 text-sm text-warn">
            {coupon.served} already served · {coupon.remaining} left
          </p>
        ) : null}
      </Card>

      <p className="mt-4 text-xs leading-relaxed text-ink-faint">
        Your family can come in more than one batch — the counter records how many eat each time.
      </p>
    </div>
  );
}
