/**
 * Domain model for the society app.
 *
 * These types are deliberately close to what the Postgres tables will look like
 * in Supabase (snake_case columns map 1:1 to these camelCase fields), so moving
 * from the local demo store to a real database is a mechanical change.
 */

/**
 * - `admin`     — committee: full control of funds, activities and gallery
 * - `volunteer` — volunteer: may record collections only, nothing else
 * - `resident`  — may view everything, change nothing
 */
export type Role = "admin" | "volunteer" | "resident";

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
  /** Where the receipt gets sent. Optional — cash at a door often has no number. */
  donorMobile?: string;
  /**
   * The flat register holds the owner's name, but a tenant often lives there
   * and is the one who actually pays. When this is set, `donorName` is the
   * tenant's name and is never overwritten from the register.
   */
  isTenant?: boolean;
  /**
   * Gapless sequential receipt number for the financial year, e.g.
   * "UK/2026-27/0042". Assigned once at entry and never changed, because an
   * auditor will check the series for gaps.
   */
  receiptNo: string;
  /** Set the first time a receipt is actually sent, for the "sent?" column. */
  receiptSentAt?: string;
  /**
   * Photograph of the paper receipt stub, or the payer's UPI confirmation
   * screenshot. This is the audit proof behind the entry — stored like gallery
   * images, so the id here maps to a record in the image store.
   */
  proofPhotoId?: string;
  /** Populated at load; not persisted with the record. */
  proofSrc?: string | null;
  /** Member id of whoever entered this — admin or volunteer. */
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

/**
 * A payment QR the society already has — the image the bank, PhonePe or Paytm
 * issued. Stored as a picture rather than generated from a UPI id, because
 * that's what committees actually have to hand, and it avoids mistyping a VPA.
 *
 * These must point at the society's *registered current account*, never a
 * committee member's personal UPI — at festival volumes that creates a tax and
 * audit problem for that individual, and banks flag it.
 */
export interface PaymentQr {
  id: string;
  /** e.g. "Janmashtami Fund — SBI current a/c" */
  label: string;
  /** Key into the image store, like gallery photographs. */
  imageId: string;
  /** Populated at load; not persisted with the record. */
  src?: string | null;
  /** Optional: restricts this QR to one activity's collection. */
  activityId?: string | null;
  /** Kept for the audit trail rather than deleted outright. */
  archived?: boolean;
  addedAt: string;
}

/** Everything the app keeps. Mirrors the set of database tables. */
export interface SocietyData {
  society: {
    name: string;
    address: string;
    /** Tower/wing names used in the flat pickers. */
    wings: string[];
    /**
     * Leading part of every receipt number, e.g. "WPC" → WPC/2026-27/0001.
     * Set it before the first receipt is issued — changing it later leaves the
     * series looking like it has gaps.
     */
    receiptPrefix?: string;
  };
  members: Member[];
  activities: Activity[];
  donations: Donation[];
  expenses: Expense[];
  albums: Album[];
  photos: Photo[];
  paymentQrs: PaymentQr[];
}
