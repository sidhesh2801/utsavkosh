import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Is the app up, and can it still reach the register?
 *
 * Called daily by the cron in vercel.json. Supabase pauses a free project
 * after about a week with no queries, and that is exactly what happens to a
 * festival app between festivals — it goes quiet in September and a resident
 * opening the donations list in October finds it broken. It slept once
 * already. One cheap query a day keeps the project awake, and the same request
 * keeps Vercel warm.
 *
 * Counts rows rather than selecting them: enough to prove the database
 * answered, without moving any data to prove it.
 *
 * Public and harmless — it reports a row count and nothing about anybody.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.json(
      { ok: false, database: "not configured" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const started = Date.now();
  const { count, error } = await supabase
    .from("donations")
    .select("id", { count: "exact", head: true });

  if (error) {
    // 503 so an uptime checker treats it as down. A paused Supabase project
    // fails here first, which is the point: it should be noticed by a monitor
    // rather than by a resident.
    return NextResponse.json(
      { ok: false, database: "unreachable", detail: error.message },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  return NextResponse.json(
    { ok: true, database: "reachable", donations: count, ms: Date.now() - started },
    { headers: { "cache-control": "no-store" } },
  );
}
