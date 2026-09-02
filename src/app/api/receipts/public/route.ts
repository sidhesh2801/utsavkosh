import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * One donation's receipt details, for the donor to download their own.
 *
 * Open, with no sign-in, and that is not a loosening: every field it returns
 * is already on the public donations list — receipt number, name, flat,
 * amount, date and transaction reference. A resident who can read the list can
 * already see all of this; the receipt only arranges it onto the society's
 * artwork. The mobile number and the note are not returned and never appear on
 * a receipt.
 *
 * Which also answers the harder problem underneath. Most QR contributions
 * reach the society with no name, and chasing a hundred and sixty people to
 * ask who they are is not going to happen. It does not have to: the donor is
 * the one person who recognises their own transaction id, so they find their
 * line and download their own receipt, and nobody has to identify anyone.
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Which receipt?" }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: "The register isn't reachable." }, { status: 503 });
  }

  // Its own client rather than the shared browser one, which persists a
  // session and expects a window. Nothing to persist here.
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // The anon key on purpose, not the service key: the column-level grants are
  // then what decide what may be read, so this route cannot accidentally hand
  // out a column the donations list withholds.
  const { data, error } = await supabase
    .from("donations")
    .select("id, receipt_no, donor_name, wing, flat, amount, method, reference, received_at")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "No such receipt." }, { status: 404 });

  const { data: society } = await supabase.from("societies").select("name").limit(1).maybeSingle();

  return NextResponse.json({
    receipt: {
      receiptNo: data.receipt_no,
      // The placeholder is not a name, and printing it on somebody's receipt
      // would be worse than leaving the line blank.
      name: String(data.donor_name).includes("QR") ? "" : data.donor_name,
      flat: [data.wing, data.flat].filter(Boolean).join("-"),
      amount: Number(data.amount),
      method: data.method,
      reference: data.reference ?? "",
      date: data.received_at,
      society: society?.name ?? "",
    },
  });
}
