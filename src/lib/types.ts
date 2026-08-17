/**
 * Domain model for the society app.
 *
 * These types are deliberately close to what the Postgres tables will look like
 * in Supabase (snake_case columns map 1:1 to these camelCase fields), so moving
 * from the local demo store to a real database is a mechanical change.
 */

/**
 * - `admin`     — committee: full control of funds, activities and gallery
 * - `collector` — volunteer: may record collections only, nothing else
 * - `resident`  — may view everything, change nothing
 */
export type Role = "admin" | "collector" | "resident";

/** A resident's account is not usable until an admin approves it. */
export type MemberStatus = "pending" | "approved" | "rejected";

export interface Member {
  id: string;
  name: string;
  email: string;
  mobile: string;
  wing: string;
  flat: string;
  role: Role;
  status: MemberStatus;
  joinedAt: string;
  /**
   * Demo-only. Real logins are handled by Supabase Auth, which stores a salted
   * hash server-side — no password ever reaches a table like this one.
   */
  password?: string;
}

export type ActivityStatus = "planned" | "ongoing" | "completed" | "cancelled";

export const ACTIVITY_CATEGORIES = [
  "festival",
  "sports",
  "social",
  "cultural",
  "workshop",
  "community-service",
] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export interface Activity {
  id: string;
  title: string;
  description: string;
  category: ActivityCategory;
  /** ISO date-time. */
  startsAt: string;
  endsAt?: string;
  venue: string;
  /** What the committee approved to spend. Compared against actual expenses. */
  budget: number;
  status: ActivityStatus;
  organiser: string;
  createdAt: string;
}

export const PAYMENT_METHODS = ["upi", "cash", "bank-transfer", "cheque"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * Cash a volunteer collects at a door is in that volunteer's pocket, not in the
 * society account. `pending` entries are visible to everyone but are excluded
 * from the balance until a committee admin confirms the handover — so the books
 * never claim money the society isn't actually holding.
 */
export type VerificationStatus = "pending" | "verified";

export interface Donation {
  id: string;
  donorName: string;
  wing?: string;
  flat?: string;
  amount: number;
  method: PaymentMethod;
  /** UPI transaction id / cheque number — the audit trail for the entry. */
  reference?: string;
  /** Earmarked to an activity, or `null` for the general society fund. */
  activityId: string | null;
  receivedAt: string;
  note?: string;
  /** Member id of whoever entered this — admin or volunteer collector. */
  recordedBy: string;
  status: VerificationStatus;
  /** Admin who confirmed the handover, and when. Empty while pending. */
  verifiedBy?: string;
  verifiedAt?: string;
  createdAt: string;
}

export const EXPENSE_CATEGORIES = [
  "decoration",
  "sound-and-lighting",
  "catering",
  "prizes-and-gifts",
  "rituals",
  "printing",
  "transport",
  "equipment-rental",
  "maintenance",
  "miscellaneous",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface Expense {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  vendor?: string;
  /** Spent on an activity, or `null` for general society spending. */
  activityId: string | null;
  paidAt: string;
  method: PaymentMethod;
  /** Bill / invoice number, so any resident can ask to see the paper. */
  billNo?: string;
  note?: string;
  recordedBy: string;
  createdAt: string;
}

export interface Album {
  id: string;
  title: string;
  /** Albums are usually tied to an activity, but can stand alone. */
  activityId: string | null;
  date: string;
  description?: string;
  createdAt: string;
}

export interface Photo {
  id: string;
  albumId: string;
  caption?: string;
  /**
   * Either a real image (data URL from an upload, later a Supabase Storage URL)
   * or `null`, in which case the UI renders a generated placeholder tile.
   */
  src: string | null;
  uploadedAt: string;
}

/** Everything the app keeps. Mirrors the set of database tables. */
export interface SocietyData {
  society: {
    name: string;
    address: string;
    wings: string[];
  };
  members: Member[];
  activities: Activity[];
  donations: Donation[];
  expenses: Expense[];
  albums: Album[];
  photos: Photo[];
}
