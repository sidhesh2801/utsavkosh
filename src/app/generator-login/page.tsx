"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Sign-in, for the committee and for the volunteers.
 *
 * Standalone rather than part of the main app shell, because the people using
 * it may have no society account at all — they just need to be someone who was
 * handed a password.
 *
 * One form, two doors. Which one opens is decided on the server by the
 * credentials, so the page never has to ask "who are you?" before the person
 * has proved it: the volunteers' password reaches the thanks page and the
 * committee's reaches everything.
 */
export default function GeneratorLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") || "/receipt-generator.html";
  /** Arrived from the thanks page, so say so rather than "Receipt generator". */
  const forThanks = next.startsWith("/volunteers");

  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/generator-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string; role?: string };
      if (!res.ok) {
        setError(payload.error ?? "That didn't work. Try again.");
        setBusy(false);
        return;
      }
      // A full navigation, not a client route change: the target is a static
      // file behind middleware, which the router can't fetch itself.
      //
      // A volunteer always lands on the thanks page. Sending them to whatever
      // `next` said would drop them on the receipt generator, which their
      // password does not open — a successful sign-in that looks like a
      // failure.
      window.location.href = payload.role === "volunteer" ? "/volunteers" : next;
    } catch {
      setError("Couldn't reach the server. Check your connection.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <span
          aria-hidden
          className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-brand-bright text-ink"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M6 3h12v18l-3-2-3 2-3-2-3 2z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <path d="M9.5 8.5h5M9.5 12.5h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </span>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-ink">
          {forThanks ? "Volunteer sign in" : "Receipt generator"}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
          {forThanks
            ? "To add your name and what you helped with. Ask the committee for the volunteer password."
            : "For committee members and collection volunteers. Ask the secretary for the password."}
        </p>
      </div>

      <div className="card p-5">
        <form onSubmit={submit} className="space-y-3.5">
          <div>
            <label htmlFor="user" className="mb-1.5 block text-[0.8125rem] font-medium text-ink">
              Username
            </label>
            <input
              id="user"
              className="field"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              required
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-[0.8125rem] font-medium text-ink">
              Password
            </label>
            <input
              id="password"
              className="field"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-lg bg-debit-soft px-3 py-2.5 text-[0.8125rem] leading-snug text-debit"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-[10px] bg-brand px-4 py-3 text-[0.9375rem] font-medium text-white transition-colors hover:bg-brand-deep disabled:opacity-50"
          >
            {busy ? "Checking…" : "Sign in"}
          </button>
        </form>
      </div>

      <p className="mt-5 text-center text-xs leading-relaxed text-ink-faint">
        You&apos;ll stay signed in on this device for 12 hours.
      </p>
    </main>
  );
}
