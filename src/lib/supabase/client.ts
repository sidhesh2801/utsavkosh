import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The Supabase browser client, or `null` when the app hasn't been pointed at a
 * project yet.
 *
 * Both keys are `NEXT_PUBLIC_` on purpose: the anon key is designed to sit in a
 * browser, and every rule that protects the data lives in row-level security in
 * the database (see supabase/schema.sql), not in secrecy of this key. The
 * `service_role` key must never appear in this file or any other client code.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when the app is running against a real shared database. */
export const isSupabaseConfigured = Boolean(url && anonKey);

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  cached ??= createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Residents browse without an account, so don't try to read a session
      // out of the URL on every public page load.
      detectSessionInUrl: false,
    },
  });
  return cached;
}

/**
 * Columns a guest is allowed to read from `donations`.
 *
 * The database grants `anon` these columns and no others, so a `select *` would
 * fail outright for a signed-out visitor — the list has to be explicit. Keep it
 * in step with the GRANT in supabase/schema.sql.
 *
 * Note what is absent: donor_name, wing, flat and donor_mobile. A guest can
 * audit every rupee but cannot see which household gave what.
 */
// Typed as `string`, not a literal: supabase-js parses literal select
// strings to infer row types, and a runtime-chosen list defeats that parser.
export const PUBLIC_DONATION_COLUMNS: string =
  "id, receipt_no, amount, method, activity_id, received_at, status, created_at";

/** Everything, for signed-in staff who need the mobile number and notes. */
export const STAFF_DONATION_COLUMNS: string = "*";
