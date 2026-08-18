"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSociety } from "@/lib/store";
import { DEMO_LOGINS } from "@/lib/seed";
import { Button, Field, Skeleton } from "@/components/ui";

/**
 * Only two kinds of account exist: committee admins and volunteers.
 *
 * Residents deliberately have no login — the accounts, gallery and receipt
 * lookup are open to everyone, so there's nothing for 1800 households to
 * register for and no approval queue for the committee to work through.
 */
export default function LoginPage() {
  const { session, ready, data, signIn } = useSociety();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (ready && session) router.replace("/collect");
  }, [ready, session, router]);

  if (!ready) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="mt-6 h-64" />
      </main>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await signIn(email, password);
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.replace("/collect");
  }

  /** Not named `use…` — that prefix makes lint treat it as a React hook. */
  function applyDemoLogin(login: { email: string; password: string }) {
    setError(null);
    setEmail(login.email);
    setPassword(login.password);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-7 text-center">
        <span
          aria-hidden
          className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-brand text-white"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 20V9.5L12 4l8 5.5V20"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M9.5 20v-5h5v5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          </svg>
        </span>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-ink">UtsavKosh</h1>
        <p className="mt-1 text-sm font-medium text-ink-soft">{data.society.name}</p>
        <p className="mt-1.5 text-sm text-ink-soft">
          Sign in to record collections and manage the society&apos;s accounts.
        </p>
      </div>

      <div className="card p-5">
        <form onSubmit={submit} className="space-y-3.5">
          <Field label="Email address" required>
            <input
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
            />
          </Field>

          <Field label="Password" required>
            <input
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </Field>

          {error ? (
            <p
              role="alert"
              className="rounded-lg bg-debit-soft px-3 py-2.5 text-[0.8125rem] leading-snug text-debit"
            >
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-ink-faint">
          Accounts are created by the committee. If you&apos;re volunteering for the collection
          and need access, ask a committee admin to add you.
        </p>
      </div>

      {/* Residents shouldn't hit a dead end here. */}
      <div className="mt-5 rounded-xl bg-brand-soft px-4 py-4">
        <p className="text-[0.8125rem] font-medium text-brand-ink">
          Are you a resident? You don&apos;t need an account.
        </p>
        <p className="mt-1 text-xs leading-relaxed text-brand-ink/80">
          The society&apos;s accounts, the photo gallery and your receipt are open to everyone.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/funds"
            className="rounded-[10px] bg-brand px-3 py-2 text-[0.8125rem] font-medium text-white transition-colors hover:bg-brand-deep"
          >
            See the accounts
          </Link>
          <Link
            href="/receipt"
            className="rounded-[10px] border border-brand/30 px-3 py-2 text-[0.8125rem] font-medium text-brand-ink transition-colors hover:bg-white/60"
          >
            Find my receipt
          </Link>
          <Link
            href="/gallery"
            className="rounded-[10px] border border-brand/30 px-3 py-2 text-[0.8125rem] font-medium text-brand-ink transition-colors hover:bg-white/60"
          >
            Photo gallery
          </Link>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-dashed border-line-strong px-4 py-4">
        <p className="text-[0.8125rem] font-medium text-ink">Try it with sample data</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => applyDemoLogin(DEMO_LOGINS.admin)}>
            Committee admin
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => applyDemoLogin(DEMO_LOGINS.volunteer)}
          >
            Volunteer
          </Button>
        </div>
      </div>
    </main>
  );
}
