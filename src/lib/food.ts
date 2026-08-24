import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GENERATOR_COOKIE, isValidSessionToken } from "./generator-auth";

/**
 * Shared plumbing for the food coupon routes.
 *
 * The coupon tables are unreachable from a browser by design. A resident has to
 * be able to create a coupon without being able to read the list — which would
 * otherwise hand anyone the name, flat and mobile of every family in the
 * society. So every operation goes through a server route holding the service
 * key, and each route decides for itself what it will return.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const foodConfigured = Boolean(SUPABASE_URL && SERVICE_KEY);

export function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** True when the request carries a valid committee session. */
export async function isCommittee(request: Request): Promise<boolean> {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${GENERATOR_COOKIE}=([^;]+)`));
  return isValidSessionToken(match?.[1]);
}

/** The activity coupons belong to — the nearest festival still to happen. */
export async function currentActivityId(db: SupabaseClient): Promise<string | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: upcoming } = await db
    .from("activities")
    .select("id")
    .gte("starts_at", today)
    .order("starts_at")
    .limit(1)
    .maybeSingle();
  if (upcoming?.id) return String(upcoming.id);

  // Nothing ahead: fall back to the most recent, so coupons still attach to
  // something sensible on the day itself.
  const { data: latest } = await db
    .from("activities")
    .select("id")
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return latest?.id ? String(latest.id) : null;
}

export async function maxMembers(db: SupabaseClient): Promise<number> {
  const { data } = await db.from("societies").select("max_coupon_members").limit(1).maybeSingle();
  const n = Number(data?.max_coupon_members);
  return Number.isFinite(n) && n > 0 ? n : 6;
}

/** What a coupon page may show. Deliberately excludes the mobile number. */
export interface PublicCoupon {
  code: string;
  name: string;
  flat: string;
  members: number;
  served: number;
  remaining: number;
  walkIn: boolean;
}

export function toPublicCoupon(row: Record<string, unknown>): PublicCoupon {
  const members = Number(row.members ?? 0);
  const served = Number(row.served ?? 0);
  return {
    code: String(row.code ?? ""),
    name: String(row.name ?? ""),
    flat: [row.wing, row.flat].filter(Boolean).join("-"),
    members,
    served,
    remaining: Math.max(0, members - served),
    walkIn: Boolean(row.walk_in),
  };
}

/**
 * Twenty-three floors, six flats on each: 101 to 2306.
 *
 * The last two digits are the flat on that floor and the digits before them are
 * the floor, so 1802 is the second flat on the eighteenth. Checking both halves
 * catches the transpositions people actually make — 2036 for 2306, 1810 for
 * 1801 — which a length check waves straight through.
 */
export const FLOORS = 23;
export const FLATS_PER_FLOOR = 6;
export const FLAT_PATTERN = /^\d{3,4}$/;

/** Normalises a flat reference so "n130", "N-130" and "n 130" are one flat. */
export function normaliseFlat(wing: string, flat: string): { wing: string | null; flat: string | null } {
  const w = wing.trim().toUpperCase().replace(/[^A-Z]/g, "");
  const f = flat.trim().replace(/[^0-9]/g, "");
  return { wing: w || null, flat: f || null };
}

/** Null when the flat is acceptable, otherwise what to tell the resident. */
export function flatProblem(flat: string | null): string | null {
  if (!flat) return "Please enter your flat number.";
  if (!FLAT_PATTERN.test(flat)) {
    return "A flat number is 3 or 4 digits, from 101 to 2306.";
  }

  const floor = Number(flat.slice(0, -2));
  const position = Number(flat.slice(-2));

  if (floor < 1 || floor > FLOORS) {
    return `There are ${FLOORS} floors, so a flat number runs from 101 to ${FLOORS}0${FLATS_PER_FLOOR}.`;
  }
  if (position < 1 || position > FLATS_PER_FLOOR) {
    return `Each floor has ${FLATS_PER_FLOOR} flats, so floor ${floor} runs from ${floor}01 to ${floor}0${FLATS_PER_FLOOR}.`;
  }
  return null;
}
