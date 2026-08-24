import { NextResponse } from "next/server";
import { foodConfigured, isCommittee, serviceClient } from "@/lib/food";

/**
 * Live counts for the counter dashboard.
 *
 * Committee only — not because the numbers are sensitive, but because the
 * recent-servings list names families, and that belongs behind the same door
 * as everything else that names people.
 */
export async function GET(request: Request) {
  if (!(await isCommittee(request))) {
    return NextResponse.json({ error: "Sign in to see the counter." }, { status: 401 });
  }
  if (!foodConfigured) {
    return NextResponse.json({ error: "Food coupons aren't set up yet." }, { status: 503 });
  }

  const db = serviceClient();
  const [{ data: summary }, { data: recent }, { data: hourly }] = await Promise.all([
    db.from("food_summary").select("*").maybeSingle(),
    db
      .from("food_servings")
      .select("count, served_at, food_coupons(name, wing, flat, code)")
      .order("served_at", { ascending: false })
      .limit(12),
    // The last few hours, to see whether the queue is building.
    db
      .from("food_servings")
      .select("count, served_at")
      .gte("served_at", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
      .order("served_at"),
  ]);

  const buckets = new Map<string, number>();
  for (const s of hourly ?? []) {
    const hour = new Date(String(s.served_at)).toISOString().slice(0, 13);
    buckets.set(hour, (buckets.get(hour) ?? 0) + Number(s.count));
  }

  return NextResponse.json({
    summary: summary ?? {
      coupons: 0,
      people_registered: 0,
      people_served: 0,
      coupons_started: 0,
      coupons_complete: 0,
      walk_ins: 0,
    },
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
