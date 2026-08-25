import { NextResponse } from "next/server";
import { foodConfigured, isCommittee, serviceClient } from "@/lib/food";

/**
 * Every coupon issued. Committee only — it names families and carries the
 * mobile numbers people gave when registering.
 */
export async function GET(request: Request) {
  if (!(await isCommittee(request))) {
    return NextResponse.json({ error: "Sign in to see the list." }, { status: 401 });
  }
  if (!foodConfigured) {
    return NextResponse.json({ error: "Food coupons aren't set up yet." }, { status: 503 });
  }

  // Scoped to one festival when the counter asks, so a volunteer running
  // Ganeshotsav does not scroll past Janmashtami's families to find a flat.
  const activity = new URL(request.url).searchParams.get("activity");
  let query = serviceClient()
    .from("food_coupons")
    .select("code, name, wing, flat, mobile, members, served, walk_in, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (activity) query = query.eq("activity_id", activity);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    coupons: (data ?? []).map((c) => ({
      code: String(c.code),
      name: String(c.name),
      flat: [c.wing, c.flat].filter(Boolean).join("-"),
      mobile: c.mobile ? String(c.mobile) : "",
      members: Number(c.members),
      served: Number(c.served),
      remaining: Math.max(0, Number(c.members) - Number(c.served)),
      walkIn: Boolean(c.walk_in),
      at: String(c.created_at),
    })),
  });
}
