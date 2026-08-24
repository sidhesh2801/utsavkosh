import { NextResponse } from "next/server";
import { foodConfigured, isCommittee, serviceClient, toPublicCoupon } from "@/lib/food";

/**
 * Looking up one coupon by its code — what the QR opens.
 *
 * Public, because the person holding the coupon needs to see it and the
 * volunteer scanning it may not be signed in yet. Returns the name, flat and
 * balance; never the mobile number, which is on the row but is nobody's
 * business at a serving counter.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  if (!foodConfigured) {
    return NextResponse.json({ error: "Food coupons aren't set up yet." }, { status: 503 });
  }

  const { code } = await params;
  const { data, error } = await serviceClient()
    .from("food_coupons")
    .select("code, name, wing, flat, members, served, walk_in")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "No coupon with that code." }, { status: 404 });

  return NextResponse.json({ coupon: toPublicCoupon(data) });
}

/**
 * Removes a registration. Committee only.
 *
 * The case this exists for: someone registers under a flat that is not theirs,
 * and the real family then cannot register at all — one coupon per flat means
 * the wrong claim blocks the right one. Deleting it frees the flat.
 *
 * Refuses once anyone has eaten on it. At that point the coupon is a record of
 * food that actually left the counter, and quietly removing it would make the
 * headcount wrong. Those need the committee to decide, not a button.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  if (!(await isCommittee(request))) {
    return NextResponse.json({ error: "Sign in to remove a registration." }, { status: 401 });
  }
  if (!foodConfigured) {
    return NextResponse.json({ error: "Food coupons aren't set up yet." }, { status: 503 });
  }

  const { code } = await params;
  const db = serviceClient();

  const { data: existing } = await db
    .from("food_coupons")
    .select("code, name, wing, flat, served")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "No coupon with that code." }, { status: 404 });
  }
  if (Number(existing.served) > 0) {
    return NextResponse.json(
      {
        error: `${existing.served} ${
          Number(existing.served) === 1 ? "person has" : "people have"
        } already eaten on this coupon, so it can't be removed — the headcount would be wrong.`,
      },
      { status: 409 },
    );
  }

  const { error } = await db.from("food_coupons").delete().eq("code", code.toUpperCase());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    freed: [existing.wing, existing.flat].filter(Boolean).join("-"),
  });
}
