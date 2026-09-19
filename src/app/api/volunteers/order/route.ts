import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { GENERATOR_COOKIE, sessionRole } from "@/lib/generator-auth";

/**
 * The order the sections appear in on the thanks page.
 *
 * Until now that was whatever order people happened to be added in — an
 * accident of typing standing in for a decision. On a page of thanks the order
 * is part of the thanks, and the committee should be able to put the senior
 * citizens at the top rather than below a section that exists because somebody
 * signed up at nine in the morning.
 *
 * The page sends the full list of section names in the order it wants them.
 * Sending the whole list rather than "move this one up" means two people
 * reordering at once cannot interleave into something neither of them chose —
 * the last save wins, whole.
 *
 * Committee only. Adding yourself is one thing; deciding whose contribution is
 * listed first is the committee's call, and it is the kind of change everyone
 * else sees.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Room between sections, so a later change to one person's place inside a
 * section never collides with the section below it.
 */
const BLOCK = 1000;

export async function POST(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${GENERATOR_COOKIE}=([^;]+)`));
  if ((await sessionRole(match?.[1])) !== "committee") {
    return NextResponse.json(
      { error: "Only the committee can reorder the credits." },
      { status: 403 },
    );
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: "The register isn't reachable." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { roles?: unknown };
  const roles = Array.isArray(body.roles)
    ? body.roles.filter((r): r is string => typeof r === "string")
    : [];

  if (!roles.length) {
    return NextResponse.json({ error: "No order was given." }, { status: 400 });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // One update per section rather than per person: a dozen sections is a
  // dozen round trips, and everyone in a section moves together anyway.
  for (const [index, role] of roles.entries()) {
    const { error } = await db
      .from("volunteers")
      .update({ sort: index * BLOCK })
      .eq("role", role);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
