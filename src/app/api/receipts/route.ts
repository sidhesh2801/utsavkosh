import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { GENERATOR_COOKIE, isValidSessionToken } from "@/lib/generator-auth";

/**
 * Receipts, issued against a payment the register already holds.
 *
 * The generator used to number its own receipts and keep no record, so nothing
 * could tell whether a donor had already been given one, and nothing stopped a
 * receipt being written for more than the society received. Both of those stop
 * being possible once the receipt is issued by the register rather than typed:
 * the amount is read from the payment, and the issue is recorded on it.
 *
 * GET  ?ref=…  find a payment by transaction id, UTR, or last 4 digits
 * POST         record that a receipt was produced, and name the donor
 * POST cash    money handed over in person, which has no reference to look up:
 *              the receipt creates the register entry as it is written
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function authorised(request: Request): Promise<boolean> {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${GENERATOR_COOKIE}=([^;]+)`));
  return isValidSessionToken(match?.[1]);
}

function admin() {
  return createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const COLUMNS =
  "id, receipt_no, donor_name, wing, flat, amount, method, reference, received_at, receipt_sent_at, receipt_issues";

interface Row {
  id: string;
  receipt_no: string;
  donor_name: string;
  wing: string | null;
  flat: string | null;
  amount: number;
  method: string;
  reference: string | null;
  received_at: string;
  receipt_sent_at: string | null;
  receipt_issues: number;
}

/** What the generator needs, and nothing it doesn't. */
function forGenerator(d: Row) {
  const reference = d.reference ?? "";
  return {
    id: d.id,
    receiptNo: d.receipt_no,
    // "Anonymous (QR payment)" is a placeholder, not a name — the generator
    // should offer an empty box rather than print that on somebody's receipt.
    name: d.donor_name.includes("QR") ? "" : d.donor_name,
    flat: [d.wing, d.flat].filter(Boolean).join("-"),
    amount: Number(d.amount),
    method: d.method,
    reference,
    // Shown in the generator's confirmation line; the receipt itself carries
    // the whole reference.
    last4: reference.slice(-4),
    date: d.received_at,
    issued: Number(d.receipt_issues) > 0,
    issuedAt: d.receipt_sent_at,
    issueCount: Number(d.receipt_issues),
  };
}

export async function GET(request: Request) {
  if (!(await authorised(request))) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: "The register isn't reachable." }, { status: 503 });
  }

  const url = new URL(request.url);
  const ref = (url.searchParams.get("ref") ?? "").trim();
  const amountParam = url.searchParams.get("amount");

  if (ref.length < 4) {
    return NextResponse.json(
      { error: "Enter at least the last 4 digits of the transaction ID." },
      { status: 400 },
    );
  }

  const db = admin();

  // Exact first. A volunteer who has the whole id should never be asked which
  // of several payments they meant.
  const { data: exact } = await db.from("donations").select(COLUMNS).eq("reference", ref);

  let rows = (exact ?? []) as unknown as Row[];

  if (!rows.length) {
    const { data: tail } = await db
      .from("donations")
      .select(COLUMNS)
      .like("reference", `%${ref}`)
      .limit(50);
    rows = (tail ?? []) as unknown as Row[];
  }

  // Last 4 digits alone are not unique across a few hundred payments, so an
  // amount narrows it. Asking for both is also the check that the person in
  // front of you really made this payment.
  if (amountParam) {
    const amount = Number(amountParam);
    if (Number.isFinite(amount)) {
      const narrowed = rows.filter((r) => Math.abs(Number(r.amount) - amount) < 0.01);
      if (narrowed.length) rows = narrowed;
    }
  }

  if (!rows.length) {
    return NextResponse.json(
      {
        error:
          "No payment with that transaction ID. Check the digits, or the payment may not be imported yet.",
      },
      { status: 404 },
    );
  }

  if (rows.length > 1) {
    return NextResponse.json({
      ambiguous: rows.map(forGenerator),
      error: `${rows.length} payments end in those digits. Add the amount to narrow it.`,
    });
  }

  return NextResponse.json({ payment: forGenerator(rows[0]) });
}

/**
 * A cash contribution, written up at the moment its receipt is.
 *
 * There is no transaction to look up — that is what cash means — so the
 * protections have to come from somewhere else. The amount is whatever was
 * handed over and only the volunteer can know it, but the register still gets
 * the entry, the receipt number still comes from the trigger rather than from
 * a device counting to itself, and the same name, amount and day is refused so
 * a second tap cannot produce a second receipt for one contribution.
 */
async function recordCash(
  db: ReturnType<typeof admin>,
  body: { name?: string; flat?: string; mobile?: string; amount?: number; date?: string },
) {
  const name = (body.name ?? "").trim();
  const amount = Number(body.amount);
  const date = (body.date ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10);

  if (!name) {
    return NextResponse.json({ error: "Whose contribution is it?" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "How much was handed over?" }, { status: 400 });
  }

  const { data: clash } = await db
    .from("donations")
    .select(COLUMNS)
    .eq("donor_name", name)
    .eq("amount", amount)
    .eq("received_at", date)
    .maybeSingle();

  if (clash) {
    const row = clash as unknown as Row;
    return NextResponse.json(
      {
        error: `${name} is already recorded for that amount on that day — receipt ${row.receipt_no}.`,
        alreadyIssued: true,
        payment: forGenerator(row),
      },
      { status: 409 },
    );
  }

  const [{ data: member }, { data: activity }] = await Promise.all([
    db.from("members").select("id").eq("role", "admin").order("joined_at").limit(1).maybeSingle(),
    db.from("activities").select("id, starts_at, ends_at").order("starts_at"),
  ]);

  // Whichever festival is running, the same rule the coupons use.
  const today = new Date().toISOString().slice(0, 10);
  const list = (activity ?? []) as Array<{ id: string; starts_at: string; ends_at: string | null }>;
  const current =
    list.find(
      (a) =>
        String(a.starts_at).slice(0, 10) <= today &&
        String(a.ends_at ?? a.starts_at).slice(0, 10) >= today,
    ) ??
    list.find((a) => String(a.starts_at).slice(0, 10) > today) ??
    list[list.length - 1];

  const flat = (body.flat ?? "").trim().toUpperCase().match(/^([A-Z]*)[-\s]?(\d{3,4})$/);
  const mobile = (body.mobile ?? "").replace(/\D/g, "");

  const { data: created, error } = await db
    .from("donations")
    .insert({
      donor_name: name,
      wing: flat?.[1] || null,
      flat: flat?.[2] || null,
      donor_mobile: mobile.length >= 10 ? mobile.slice(-10) : null,
      amount,
      method: "cash",
      received_at: date,
      activity_id: current?.id ?? null,
      recorded_by: member?.id,
      status: "verified",
      note: "Cash, receipted in person",
      receipt_issues: 1,
      receipt_sent_at: new Date().toISOString(),
    })
    .select(COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, duplicate: false, payment: forGenerator(created as unknown as Row) });
}

/**
 * Records that a receipt was produced, and takes the donor's details.
 *
 * Naming happens here because this is the moment it becomes possible: a QR
 * payment arrives anonymous, and the person collecting their receipt is the
 * one person who can say whose it is.
 */
export async function POST(request: Request) {
  if (!(await authorised(request))) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: "The register isn't reachable." }, { status: 503 });
  }

  let body: {
    id?: string;
    name?: string;
    flat?: string;
    mobile?: string;
    reissue?: boolean;
    cash?: boolean;
    amount?: number;
    date?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Could not read the request." }, { status: 400 });
  }

  const db = admin();

  if (body.cash) return recordCash(db, body);

  const id = (body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "Which payment?" }, { status: 400 });
  const { data: found } = await db.from("donations").select(COLUMNS).eq("id", id).maybeSingle();
  const row = found as unknown as Row | null;

  if (!row) {
    return NextResponse.json({ error: "That payment is no longer in the register." }, { status: 404 });
  }

  // The guard the committee asked for. A second receipt is possible, but only
  // deliberately — it prints as a duplicate and is counted, so two originals
  // for one payment cannot quietly exist.
  if (Number(row.receipt_issues) > 0 && !body.reissue) {
    return NextResponse.json(
      {
        error: `Receipt ${row.receipt_no} was already issued for this payment${
          row.receipt_sent_at ? ` on ${row.receipt_sent_at.slice(0, 10)}` : ""
        }.`,
        alreadyIssued: true,
        payment: forGenerator(row),
      },
      { status: 409 },
    );
  }

  const patch: Record<string, unknown> = {
    receipt_issues: Number(row.receipt_issues) + 1,
    receipt_sent_at: new Date().toISOString(),
  };

  // Only fills a blank. A receipt being written is not a reason to overwrite a
  // name the bank already gave us.
  const name = (body.name ?? "").trim();
  if (name && row.donor_name.includes("QR")) patch.donor_name = name;

  const flat = (body.flat ?? "").trim();
  if (flat && !row.flat) {
    const m = flat.toUpperCase().match(/^([A-Z]*)[-\s]?(\d{3,4})$/);
    if (m) {
      if (m[1]) patch.wing = m[1];
      patch.flat = m[2];
    }
  }

  const mobile = (body.mobile ?? "").replace(/\D/g, "");
  if (mobile.length >= 10) patch.donor_mobile = mobile.slice(-10);

  const { error } = await db.from("donations").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: after } = await db.from("donations").select(COLUMNS).eq("id", id).maybeSingle();
  return NextResponse.json({
    ok: true,
    duplicate: Number(row.receipt_issues) > 0,
    payment: forGenerator(after as unknown as Row),
  });
}
