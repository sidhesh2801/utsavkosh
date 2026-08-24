import { NextResponse } from "next/server";
import {
  currentActivityId,
  flatProblem,
  foodConfigured,
  isCommittee,
  maxMembers,
  normaliseFlat,
  serviceClient,
  toPublicCoupon,
} from "@/lib/food";

/** The cap, so the registration form can offer only valid choices. */
export async function GET() {
  if (!foodConfigured) return NextResponse.json({ maxMembers: 5 });
  return NextResponse.json({ maxMembers: await maxMembers(serviceClient()) });
}

/**
 * Registering for a food coupon. Open to any resident with the link.
 *
 * One coupon per flat, enforced by a unique index rather than a check here —
 * two people in the same household registering at the same moment would both
 * pass a check-then-insert, and the database is the only place that can
 * actually settle it.
 */
export async function POST(request: Request) {
  if (!foodConfigured) {
    return NextResponse.json({ error: "Food coupons aren't set up yet." }, { status: 503 });
  }

  let body: {
    name?: string;
    wing?: string;
    flat?: string;
    mobile?: string;
    members?: number;
    walkIn?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Could not read the request." }, { status: 400 });
  }

  const db = serviceClient();
  const name = (body.name ?? "").trim();
  const members = Math.floor(Number(body.members));
  const cap = await maxMembers(db);

  if (!name) return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  if (!Number.isFinite(members) || members < 1) {
    return NextResponse.json({ error: "How many will be eating?" }, { status: 400 });
  }

  // Only the committee may exceed the cap, and only for a walk-in they are
  // standing in front of.
  const committee = await isCommittee(request);
  const walkIn = Boolean(body.walkIn) && committee;
  if (members > cap && !committee) {
    return NextResponse.json(
      {
        error: `Coupons cover up to ${cap} people. For a larger family, please ask a committee member.`,
      },
      { status: 400 },
    );
  }

  const { wing, flat } = normaliseFlat(body.wing ?? "", body.flat ?? "");
  if (!walkIn) {
    if (!wing) {
      return NextResponse.json({ error: "Please choose your tower." }, { status: 400 });
    }
    const problem = flatProblem(flat);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  }

  const activityId = await currentActivityId(db);

  const { data, error } = await db
    .from("food_coupons")
    .insert({
      activity_id: activityId,
      name,
      wing,
      flat,
      mobile: (body.mobile ?? "").trim() || null,
      members,
      walk_in: walkIn,
    })
    .select("code, name, wing, flat, members, served, walk_in")
    .single();

  if (error) {
    // 23505 is the one-coupon-per-flat index. Hand back the existing coupon
    // rather than an error: someone who registered twice wants their QR, not
    // to be told off.
    if (error.code === "23505" && wing && flat) {
      const { data: existing } = await db
        .from("food_coupons")
        .select("code, name, wing, flat, members, served, walk_in")
        .eq("activity_id", activityId)
        .ilike("wing", wing)
        .eq("flat", flat)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({
          coupon: toPublicCoupon(existing),
          alreadyRegistered: true,
        });
      }
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ coupon: toPublicCoupon(data) });
}
