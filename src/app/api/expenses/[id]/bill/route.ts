import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { GENERATOR_COOKIE, isValidSessionToken } from "@/lib/generator-auth";

/**
 * A link to one ledger entry's attached bill.
 *
 * Takes the expense id, not the storage key — the key is withheld from every
 * browser, so the only way to reach a file is to name a ledger row and hold a
 * committee session. The link it returns expires, because the image can be a
 * UPI confirmation showing the payer's own account, and a link that outlives
 * the session is a link that gets forwarded.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Long enough to open it, short enough that a copied link goes stale. */
const LINK_SECONDS = 300;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${GENERATOR_COOKIE}=([^;]+)`));
  if (!(await isValidSessionToken(match?.[1]))) {
    return NextResponse.json(
      { error: "The bill is kept with the committee." },
      { status: 401 },
    );
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: "Storage isn't configured." }, { status: 503 });
  }

  const { id } = await params;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: row } = await supabase
    .from("expenses")
    .select("bill_path")
    .eq("id", id)
    .maybeSingle();

  if (!row?.bill_path) {
    return NextResponse.json({ error: "Nothing is attached to this entry." }, { status: 404 });
  }

  const { data, error } = await supabase
    .storage.from("bills")
    .createSignedUrl(String(row.bill_path), LINK_SECONDS);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message ?? "That file is missing from storage." },
      { status: 404 },
    );
  }
  return NextResponse.json({ url: data.signedUrl, expiresIn: LINK_SECONDS });
}
