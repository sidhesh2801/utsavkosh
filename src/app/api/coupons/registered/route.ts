import { NextResponse } from "next/server";
import { foodConfigured, serviceClient } from "@/lib/food";

/**
 * Who has registered, for the registration page.
 *
 * Public, so a resident can check their flat is on the list without asking
 * anyone — the same reasoning as the donations list. Name, flat and how many
 * they registered for, and nothing else: not the mobile number they gave, and
 * not the coupon code, which is the thing that gets scanned.
 */
export async function GET() {
  if (!foodConfigured) return NextResponse.json({ families: [], people: 0 });

  const { data, error } = await serviceClient()
    .from("food_coupons")
    .select("name, wing, flat, members, created_at")
    .order("created_at", { ascending: false })
    .limit(3000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const families = (data ?? []).map((c) => ({
    name: String(c.name),
    flat: [c.wing, c.flat].filter(Boolean).join("-"),
    members: Number(c.members),
  }));

  return NextResponse.json({
    families,
    people: families.reduce((t, f) => t + f.members, 0),
  });
}
