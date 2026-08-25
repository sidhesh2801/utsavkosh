import { NextResponse } from "next/server";
import { foodConfigured, isCommittee, serviceClient } from "@/lib/food";

/**
 * Live counts for the counter dashboard.
 *
 * Committee only — not because the numbers are sensitive, but because the
 * recent-servings list names families, and that belongs behind the same door
 * as everything else that names people.
 *
 * `?activity=` scopes everything to one festival. Without it the counter would
 * add Ganeshotsav's queue to Janmashtami's and tell a volunteer that twice as
 * many people had eaten as were standing in front of them.
 */
export async function GET(request: Request) {
  if (!(await isCommittee(request))) {
    return NextResponse.json({ error: "Sign in to see the counter." }, { status: 401 });
  }
  if (!foodConfigured) {
    return NextResponse.json({ error: "Food coupons aren't set up yet." }, { status: 503 });
  }

  const db = serviceClient();
  const activity = new URL(request.url).searchParams.get("activity");

  // Counted from the rows rather than read from the food_summary view, because
  // the view has no notion of a festival and this has to be able to scope.
  let couponQuery = db.from("food_coupons").select("members, served, walk_in");
  if (activity) couponQuery = couponQuery.eq("activity_id", activity);

  // `!inner` matters: without it PostgREST filters the embedded coupon but
  // keeps the serving, and every other festival's servings come back with a
  // null coupon attached.
  let recentQuery = db
    .from("food_servings")
    .select("count, served_at, food_coupons!inner(name, wing, flat, code, activity_id)")
    .order("served_at", { ascending: false })
    .limit(12);
  if (activity) recentQuery = recentQuery.eq("food_coupons.activity_id", activity);

  let hourlyQuery = db
    .from("food_servings")
    .select("count, served_at, food_coupons!inner(activity_id)")
    .gte("served_at", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
    .order("served_at");
  if (activity) hourlyQuery = hourlyQuery.eq("food_coupons.activity_id", activity);

  const [{ data: rows }, { data: recent }, { data: hourly }] = await Promise.all([
    couponQuery,
    recentQuery,
    hourlyQuery,
  ]);

  const summary = (rows ?? []).reduce(
    (acc, r) => {
      const members = Number(r.members);
      const served = Number(r.served);
      acc.coupons += 1;
      acc.people_registered += members;
      acc.people_served += served;
      if (served > 0) acc.coupons_started += 1;
      if (served >= members) acc.coupons_complete += 1;
      if (r.walk_in) acc.walk_ins += 1;
      return acc;
    },
    {
      coupons: 0,
      people_registered: 0,
      people_served: 0,
      coupons_started: 0,
      coupons_complete: 0,
      walk_ins: 0,
    },
  );

  const buckets = new Map<string, number>();
  for (const s of hourly ?? []) {
    const hour = new Date(String(s.served_at)).toISOString().slice(0, 13);
    buckets.set(hour, (buckets.get(hour) ?? 0) + Number(s.count));
  }

  return NextResponse.json({
    summary,
    recent: (recent ?? []).map((r) => {
      const c = r.food_coupons as unknown as Record<string, unknown> | null;
      return {
        count: Number(r.count),
        at: String(r.served_at),
        name: String(c?.name ?? "—"),
        flat: [c?.wing, c?.flat].filter(Boolean).join("-"),
        code: String(c?.code ?? ""),
      };
    }),
    perHour: [...buckets.entries()].map(([hour, people]) => ({ hour, people })),
  });
}
