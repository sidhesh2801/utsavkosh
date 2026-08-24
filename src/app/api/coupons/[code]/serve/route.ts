import { NextResponse } from "next/server";
import { foodConfigured, isCommittee, serviceClient } from "@/lib/food";

/**
 * Recording that people have eaten. Committee only.
 *
 * The check and the increment happen inside one database function holding a
 * row lock, so two volunteers scanning the same coupon at the same moment
 * cannot both serve the last two meals.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  if (!(await isCommittee(request))) {
    return NextResponse.json(
      { error: "Sign in with the committee password to serve." },
      { status: 401 },
    );
  }
  if (!foodConfigured) {
    return NextResponse.json({ error: "Food coupons aren't set up yet." }, { status: 503 });
  }

  const { code } = await params;
  let count = 1;
  try {
    const body = (await request.json()) as { count?: number };
    count = Math.floor(Number(body.count ?? 1));
  } catch {
    /* no body means one person */
  }

  const { data, error } = await serviceClient().rpc("serve_coupon", {
    p_code: code.toUpperCase(),
    p_count: count,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.ok) {
    // A refusal is an ordinary outcome at a counter, not a fault: 409 so the
    // page can show "already fully served" plainly.
    return NextResponse.json(
      { error: result?.reason ?? "Could not serve", ...result },
      { status: 409 },
    );
  }
  return NextResponse.json(result);
}
