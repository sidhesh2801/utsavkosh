/** Formatting helpers. Money is always rupees with Indian digit grouping. */

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrPrecise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
});

/** ₹1,85,000 — the grouping Indian readers expect, not ₹185,000. */
export function money(amount: number): string {
  return inr.format(amount);
}

export function moneyPrecise(amount: number): string {
  return inrPrecise.format(amount);
}

/** Compact form for tight spaces: ₹1.85L, ₹12.5K. */
export function moneyShort(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 10_000_000) return `${sign}₹${(abs / 10_000_000).toFixed(2)}Cr`;
  if (abs >= 100_000) return `${sign}₹${(abs / 100_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${abs}`;
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function dayMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Sat, 14 Sep 2026 · 6:30 pm" */
export function dateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })} · ${timeOfDay(iso)}`;
}

/** "in 27 days" / "3 days ago" — for event proximity. */
export function relativeDays(iso: string, from: Date = new Date()): string {
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round(
    (startOfDay(new Date(iso)) - startOfDay(from)) / 86_400_000,
  );
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

/** "sound-and-lighting" → "Sound and lighting" */
export function humanise(slug: string): string {
  const words = slug.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** `humanise` would give "Upi", so payment methods get an explicit map. */
const METHOD_LABELS: Record<string, string> = {
  upi: "UPI",
  cash: "Cash",
  "bank-transfer": "Bank transfer",
  cheque: "Cheque",
};

export function methodLabel(method: string): string {
  return METHOD_LABELS[method] ?? humanise(method);
}

/** "A-1204" */
export function flatLabel(wing?: string, flat?: string): string {
  if (!wing && !flat) return "—";
  if (!wing) return flat!;
  if (!flat) return `Wing ${wing}`;
  return `${wing}-${flat}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** For <input type="date"> values, in local time (not UTC — avoids off-by-one). */
export function toDateInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toDateTimeInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${toDateInput(iso)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function percent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}
