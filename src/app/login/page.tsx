"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSociety } from "@/lib/store";
import { DEMO_LOGINS } from "@/lib/seed";
import { Button, Field, Skeleton } from "@/components/ui";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const { session, ready, data, signIn, signUp } = useSociety();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [wing, setWing] = useState("");
  const [flat, setFlat] = useState("");

  useEffect(() => {
    if (ready && session) router.replace("/");
  }, [ready, session, router]);

  if (!ready) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="mt-6 h-64" />
      </main>
    );
  }

  const wings = data.society.wings;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const result = await signIn(email, password);
        if (!result.ok) setError(result.error);
        else router.replace("/");
      } else {
        const result = await signUp({ name, email, mobile, wing, flat, password });
        if (!result.ok) {
          setError(result.error);
        } else {
          setMode("signin");
          setNotice(
            "Account created. A committee admin needs to approve it before you can sign in — you'll usually hear back within a day.",
          );
          setName("");
          setMobile("");
          setWing("");
          setFlat("");
          setPassword("");
        }
      }
    } finally {
      setBusy(false);
    }
  }

  /** Not named `use…` — that prefix makes lint treat it as a React hook. */
  function applyDemoLogin(login: { email: string; password: string }) {
    setMode("signin");
    setError(null);
    setNotice(null);
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
          Cultural activities, funds and photographs — open to every resident.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="flex border-b border-line" role="tablist">
          {(
            [
              ["signin", "Sign in"],
              ["signup", "Register your flat"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => {
                setMode(value);
                setError(null);
                setNotice(null);
              }}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                mode === value
                  ? "bg-brand-soft text-brand-ink"
                  : "text-ink-soft hover:bg-surface-sunken"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3.5 p-5">
          {mode === "signup" ? (
            <>
              <Field label="Your full name" required>
                <input
                  className="field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  placeholder="e.g. Sunil Kulkarni"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Wing" required>
                  {wings.length ? (
                    <select
                      className="field"
                      value={wing}
                      onChange={(e) => setWing(e.target.value)}
                      required
                    >
                      <option value="">Select</option>
                      {wings.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="field"
                      value={wing}
                      onChange={(e) => setWing(e.target.value)}
                      required
                      placeholder="A"
                    />
                  )}
                </Field>
                <Field label="Flat number" required>
                  <input
                    className="field"
                    value={flat}
                    onChange={(e) => setFlat(e.target.value)}
                    required
                    inputMode="numeric"
                    placeholder="305"
                  />
                </Field>
              </div>
              <Field label="Mobile number" hint="So the committee can reach you." required>
                <input
                  className="field"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  required
                  type="tel"
                  autoComplete="tel"
                  placeholder="98200 11234"
                />
              </Field>
            </>
          ) : null}

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

          <Field
            label="Password"
            hint={mode === "signup" ? "At least 6 characters." : undefined}
            required
          >
            <input
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
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
          {notice ? (
            <p
              role="status"
              className="rounded-lg bg-brand-soft px-3 py-2.5 text-[0.8125rem] leading-snug text-brand-ink"
            >
              {notice}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>

          {mode === "signup" ? (
            <p className="text-xs leading-relaxed text-ink-faint">
              New registrations are held for committee approval, so only residents of{" "}
              {data.society.name} can get in.
            </p>
          ) : null}
        </form>
      </div>

      <div className="mt-6 rounded-xl border border-dashed border-line-strong px-4 py-4">
        <p className="text-[0.8125rem] font-medium text-ink">Try it without signing up</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          This is sample data for a fictional society. Sign in as any of the three roles to see
          what each one can do.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => applyDemoLogin(DEMO_LOGINS.admin)}>
            Committee admin
          </Button>
          <Button size="sm" variant="secondary" onClick={() => applyDemoLogin(DEMO_LOGINS.collector)}>
            Volunteer collector
          </Button>
          <Button size="sm" variant="secondary" onClick={() => applyDemoLogin(DEMO_LOGINS.resident)}>
            Resident
          </Button>
        </div>
      </div>
    </main>
  );
}
