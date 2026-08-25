import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { GENERATOR_COOKIE, isValidSessionToken } from "@/lib/generator-auth";

/**
 * Festivals, for the committee.
 *
 * The app could already keep several festivals apart — every donation, expense
 * and coupon carries an activity_id — but there was no way to create one. The
 * only route in was the older Supabase Auth screen, and no accounts exist for
 * it, so in practice the society was stuck with the single festival that had
 * been inserted by hand. This is the committee-session equivalent, so the same
 * password that writes the ledger can open next year's Ganeshotsav.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function authorised(request: Request): Promise<boolean> {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${GENERATOR_COOKIE}=([^;]+)`));
  return isValidSessionToken(match?.[1]);
}

function admin() {
  return createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function configured() {
  return SUPABASE_URL && SERVICE_KEY
    ? null
    : NextResponse.json(
        { error: "Adding a festival needs SUPABASE_SERVICE_ROLE_KEY set in Vercel." },
        { status: 503 },
      );
}

interface Body {
  id?: string;
  title?: string;
  description?: string;
  category?: string;
  startsAt?: string;
  endsAt?: string | null;
  venue?: string;
  budget?: number;
  status?: string;
  organiser?: string;
}

const STATUSES = ["planned", "ongoing", "completed", "cancelled"];

/** Turns a date input's "2026-09-14" into a timestamp the column will take. */
function asTimestamp(value: string): string | null {
  if (!value) return null;
  const date = new Date(value.length === 10 ? `${value}T09:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function POST(request: Request) {
  if (!(await authorised(request))) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }
  const blocked = configured();
  if (blocked) return blocked;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Could not read the request." }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Give the festival a name." }, { status: 400 });
  }

  const startsAt = asTimestamp(body.startsAt ?? "");
  if (!startsAt) {
    return NextResponse.json({ error: "When does it start?" }, { status: 400 });
  }

  const endsAt = body.endsAt ? asTimestamp(body.endsAt) : null;
  if (endsAt && endsAt < startsAt) {
    return NextResponse.json({ error: "It can't end before it starts." }, { status: 400 });
  }

  const { data, error } = await admin()
    .from("activities")
    .insert({
      title,
      description: (body.description ?? "").trim(),
      category: body.category || "festival",
      starts_at: startsAt,
      ends_at: endsAt,
      venue: (body.venue ?? "").trim(),
      budget: Number(body.budget) > 0 ? Number(body.budget) : 0,
      status: STATUSES.includes(body.status ?? "") ? body.status : "planned",
      organiser: (body.organiser ?? "").trim(),
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function PATCH(request: Request) {
  if (!(await authorised(request))) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }
  const blocked = configured();
  if (blocked) return blocked;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Could not read the request." }, { status: 400 });
  }

  const id = (body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "Which festival?" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (body.title !== undefined) {
    const title = body.title.trim();
    if (!title) return NextResponse.json({ error: "Give the festival a name." }, { status: 400 });
    patch.title = title;
  }
  if (body.startsAt !== undefined) {
    const startsAt = asTimestamp(body.startsAt);
    if (!startsAt) return NextResponse.json({ error: "When does it start?" }, { status: 400 });
    patch.starts_at = startsAt;
  }
  if (body.endsAt !== undefined) patch.ends_at = body.endsAt ? asTimestamp(body.endsAt) : null;
  if (body.description !== undefined) patch.description = body.description.trim();
  if (body.venue !== undefined) patch.venue = body.venue.trim();
  if (body.organiser !== undefined) patch.organiser = body.organiser.trim();
  if (body.budget !== undefined) patch.budget = Number(body.budget) > 0 ? Number(body.budget) : 0;
  if (body.status !== undefined && STATUSES.includes(body.status)) patch.status = body.status;

  const { error } = await admin().from("activities").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/**
 * Removes a festival, but only an empty one.
 *
 * The database would refuse anyway — donations and expenses reference the row
 * with `on delete restrict` — but the error it raises reads like a stack
 * trace. Better to check first and say what is actually in the way, because
 * the answer ("move these 104 donations somewhere") is not obvious.
 */
export async function DELETE(request: Request) {
  if (!(await authorised(request))) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }
  const blocked = configured();
  if (blocked) return blocked;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Which festival?" }, { status: 400 });

  const supabase = admin();
  const [donations, expenses, coupons] = await Promise.all([
    supabase.from("donations").select("id", { count: "exact", head: true }).eq("activity_id", id),
    supabase.from("expenses").select("id", { count: "exact", head: true }).eq("activity_id", id),
    supabase
      .from("food_coupons")
      .select("id", { count: "exact", head: true })
      .eq("activity_id", id),
  ]);

  const held = [
    donations.count ? `${donations.count} donations` : "",
    expenses.count ? `${expenses.count} ledger entries` : "",
    coupons.count ? `${coupons.count} food coupons` : "",
  ].filter(Boolean);

  if (held.length) {
    return NextResponse.json(
      {
        error: `This festival still has ${held.join(", ")} recorded against it. Move or remove those first — deleting it would take the money records with it.`,
      },
      { status: 409 },
    );
  }

  const { error } = await supabase.from("activities").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
