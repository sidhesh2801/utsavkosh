import { NextResponse } from "next/server";
import { foodConfigured, serviceClient, toPublicCoupon } from "@/lib/food";

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
