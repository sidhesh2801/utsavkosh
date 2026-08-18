import type { Activity, Donation, Expense, ExpenseCategory } from "./types";

/**
 * All the money maths, kept as pure functions so the numbers on screen are easy
 * to reason about and to check by hand against the ledger.
 */

export function sumBy<T>(items: T[], value: (item: T) => number): number {
  return items.reduce((total, item) => total + value(item), 0);
}

export const totalOf = (items: Array<{ amount: number }>) => sumBy(items, (i) => i.amount);

export const verified = (donations: Donation[]) => donations.filter((d) => d.status === "verified");
export const pending = (donations: Donation[]) => donations.filter((d) => d.status === "pending");

export interface FundSummary {
  /** Verified money only — what the society can actually account for. */
  collected: number;
  /** Recorded by a volunteer but not yet handed over. Deliberately excluded above. */
  pendingCollection: number;
  /** collected + pendingCollection — the full picture of what residents have given. */
  pledged: number;
  spent: number;
  /** What the society holds today: verified in, minus everything out. */
  balance: number;
  donationCount: number;
  pendingCount: number;
  expenseCount: number;
  donorCount: number;
}

export function fundSummary(donations: Donation[], expenses: Expense[]): FundSummary {
  const confirmed = totalOf(verified(donations));
  const awaiting = totalOf(pending(donations));
  return {
    collected: confirmed,
    pendingCollection: awaiting,
    pledged: confirmed + awaiting,
    spent: totalOf(expenses),
    balance: confirmed - totalOf(expenses),
    donationCount: donations.length,
    pendingCount: pending(donations).length,
    expenseCount: expenses.length,
    donorCount: new Set(donations.map((d) => d.donorName.toLowerCase())).size,
  };
}

export interface VolunteerTotal {
  volunteerId: string;
  /** Verified handovers. */
  verifiedAmount: number;
  /** Cash still in this volunteer's hands. */
  pendingAmount: number;
  total: number;
  count: number;
  lastEntryAt: string | null;
}

/**
 * Per-volunteer collection totals for a drive — the live leaderboard, and more
 * importantly the "who owes the treasurer how much cash" list.
 */
export function volunteerTotals(donations: Donation[]): VolunteerTotal[] {
  const buckets = new Map<string, VolunteerTotal>();
  for (const d of donations) {
    const bucket = buckets.get(d.recordedBy) ?? {
      volunteerId: d.recordedBy,
      verifiedAmount: 0,
      pendingAmount: 0,
      total: 0,
      count: 0,
      lastEntryAt: null,
    };
    if (d.status === "verified") bucket.verifiedAmount += d.amount;
    else bucket.pendingAmount += d.amount;
    bucket.total += d.amount;
    bucket.count += 1;
    if (!bucket.lastEntryAt || d.createdAt > bucket.lastEntryAt) bucket.lastEntryAt = d.createdAt;
    buckets.set(d.recordedBy, bucket);
  }
  return [...buckets.values()].sort((a, b) => b.total - a.total);
}

/** Flats that have contributed to a given drive, for the "who's left" list. */
export function contributedFlats(donations: Donation[]): Set<string> {
  return new Set(
    donations
      .filter((d) => d.wing && d.flat)
      .map((d) => `${d.wing!.toUpperCase()}-${d.flat}`),
  );
}

export interface ActivityFinance extends FundSummary {
  budget: number;
  /** Actual spend as a share of the approved budget. Can exceed 100. */
  budgetUsedPct: number;
  /** Budget left unspent — negative means the activity overshot. */
  budgetRemaining: number;
  /** How much of the budget the collections cover. */
  fundedPct: number;
}

export function activityFinance(
  activity: Activity,
  donations: Donation[],
  expenses: Expense[],
): ActivityFinance {
  const forActivity = donations.filter((d) => d.activityId === activity.id);
  const spentOn = expenses.filter((e) => e.activityId === activity.id);
  const summary = fundSummary(forActivity, spentOn);
  return {
    ...summary,
    budget: activity.budget,
    budgetUsedPct: activity.budget > 0 ? Math.round((summary.spent / activity.budget) * 100) : 0,
    budgetRemaining: activity.budget - summary.spent,
    fundedPct: activity.budget > 0 ? Math.round((summary.collected / activity.budget) * 100) : 0,
  };
}

export interface CategorySlice {
  category: ExpenseCategory;
  amount: number;
  count: number;
  pct: number;
}

/** Expense split by category, largest first — the "where did it go" answer. */
export function expensesByCategory(expenses: Expense[]): CategorySlice[] {
  const total = totalOf(expenses);
  const buckets = new Map<ExpenseCategory, { amount: number; count: number }>();
  for (const e of expenses) {
    const bucket = buckets.get(e.category) ?? { amount: 0, count: 0 };
    bucket.amount += e.amount;
    bucket.count += 1;
    buckets.set(e.category, bucket);
  }
  return [...buckets.entries()]
    .map(([category, b]) => ({
      category,
      amount: b.amount,
      count: b.count,
      pct: total > 0 ? Math.round((b.amount / total) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export interface ActivitySpendSlice {
  activityId: string | null;
  label: string;
  amount: number;
  pct: number;
}

/** Expense split by activity — the other half of "where did it go". */
export function expensesByActivity(
  expenses: Expense[],
  activities: Activity[],
): ActivitySpendSlice[] {
  const total = totalOf(expenses);
  const titleOf = new Map(activities.map((a) => [a.id, a.title]));
  const buckets = new Map<string, number>();
  for (const e of expenses) {
    const key = e.activityId ?? "__general__";
    buckets.set(key, (buckets.get(key) ?? 0) + e.amount);
  }
  return [...buckets.entries()]
    .map(([key, amount]) => ({
      activityId: key === "__general__" ? null : key,
      label: key === "__general__" ? "General society spending" : (titleOf.get(key) ?? "Unknown"),
      amount,
      pct: total > 0 ? Math.round((amount / total) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export interface DonorTotal {
  donorName: string;
  wing?: string;
  flat?: string;
  amount: number;
  count: number;
}

/** Contributors ranked by total given, across all activities. */
export function donorTotals(donations: Donation[]): DonorTotal[] {
  const buckets = new Map<string, DonorTotal>();
  for (const d of donations) {
    const key = d.donorName.toLowerCase();
    const existing = buckets.get(key);
    if (existing) {
      existing.amount += d.amount;
      existing.count += 1;
    } else {
      buckets.set(key, {
        donorName: d.donorName,
        wing: d.wing,
        flat: d.flat,
        amount: d.amount,
        count: 1,
      });
    }
  }
  return [...buckets.values()].sort((a, b) => b.amount - a.amount);
}

export interface MonthFlow {
  /** "2026-08" */
  key: string;
  label: string;
  collected: number;
  spent: number;
}

/**
 * Money in and out per calendar month, oldest first, covering every month from
 * the first record to `upto` so gaps show as genuinely empty rather than closing up.
 */
export function monthlyFlow(
  donations: Donation[],
  expenses: Expense[],
  monthCount = 12,
  upto: Date = new Date(),
): MonthFlow[] {
  const months: MonthFlow[] = [];
  const cursor = new Date(upto.getFullYear(), upto.getMonth(), 1);
  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-IN", { month: "short" }),
      collected: 0,
      spent: 0,
    });
  }
  const index = new Map(months.map((m, i) => [m.key, i]));
  const keyOf = (iso: string) => iso.slice(0, 7);

  for (const d of donations) {
    const i = index.get(keyOf(d.receivedAt));
    if (i !== undefined) months[i].collected += d.amount;
  }
  for (const e of expenses) {
    const i = index.get(keyOf(e.paidAt));
    if (i !== undefined) months[i].spent += e.amount;
  }
  return months;
}

export type LedgerEntry =
  | { kind: "donation"; date: string; entry: Donation }
  | { kind: "expense"; date: string; entry: Expense };

/** Donations and expenses interleaved newest-first — the full audit trail. */
export function ledger(donations: Donation[], expenses: Expense[]): LedgerEntry[] {
  const entries: LedgerEntry[] = [
    ...donations.map((d) => ({ kind: "donation" as const, date: d.receivedAt, entry: d })),
    ...expenses.map((e) => ({ kind: "expense" as const, date: e.paidAt, entry: e })),
  ];
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

/** Activities sorted by how soon they start; upcoming ones first. */
export function upcomingActivities(activities: Activity[], from: Date = new Date()): Activity[] {
  const now = from.getTime();
  return activities
    .filter((a) => a.status !== "cancelled" && new Date(a.endsAt ?? a.startsAt).getTime() >= now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function pastActivities(activities: Activity[], from: Date = new Date()): Activity[] {
  const now = from.getTime();
  return activities
    .filter((a) => new Date(a.endsAt ?? a.startsAt).getTime() < now || a.status === "cancelled")
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
}
