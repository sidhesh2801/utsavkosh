import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-faint">
        Not found
      </p>
      <h1 className="mt-2 text-xl font-semibold text-ink">This page doesn&apos;t exist</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        The activity, album or entry you were looking for may have been removed.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-deep"
      >
        Back to home
      </Link>
    </main>
  );
}
