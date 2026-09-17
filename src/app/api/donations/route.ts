import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { GENERATOR_COOKIE, isValidSessionToken } from "@/lib/generator-auth";

/**
 * Recording a contribution by hand, for money that never touches the bank —
 * cash at a door, mostly.
 *
 * Anything paid by UPI or transfer should come in through the daily statement
 * import instead: the bank is the record, and typing it in a second time only
 * creates a duplicate to reconcile away later. That is why this defaults to
 * cash rather than offering every method equally.
 *
 * Authorised by the committee session — the same password as the receipt
 * generator. Because that is the app's own login rather than a Supabase Auth
 * account, the write cannot pass through row-level security, so it runs here
 * with the service key and every request is re-checked.
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

/** Whoever hand-entered rows get attributed to. */
async function committeeMemberId(): Promise<string> {
  const supabase = admin();
  const { data } = await supabase
    .from("members")
    .select("id")
    .eq("role", "admin")
    .order("joined_at")
    .limit(1)
    .maybeSingle();
  if (data?.id) return String(data.id);

  const { data: created, error } = await supabase
    .from("members")
    .insert({ name: "Festival Committee", role: "admin", status: "approved" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return String(created.id);
}

interface Body {
  id?: string;
  donorName?: string;
  wing?: string;
  flat?: string;
  amount?: number;
  method?: string;
  reference?: string;
  receivedAt?: string;
  activityId?: string | null;
  isTenant?: boolean;
}

export async function POST(request: Request) {
  if (!(await authorised(request))) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json(
      {
        error:
          "Recording contributions needs the SUPABASE_SERVICE_ROLE_KEY environment variable.",
      },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Could not read the request." }, { status: 400 });
  }

  const donorName = (body.donorName ?? "").trim();
  const amount = Number(body.amount);
  if (!donorName) {
    return NextResponse.json({ error: "Enter the contributor's name." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be more than zero." }, { status: 400 });
  }

  const receivedAt = body.receivedAt || new Date().toISOString().slice(0, 10);
  const reference = (body.reference ?? "").trim() || null;
  const supabase = admin();

  try {
    /**
     * Refuse an entry the statement import would also bring in. The same test
     * the generated SQL uses, so a cash entry typed today and a statement
     * imported tonight cannot produce two rows for one contribution.
     */
    const { data: clash } = await supabase
      .from("donations")
      .select("id, receipt_no")
      .eq("donor_name", donorName)
      .eq("amount", amount)
      .eq("received_at", receivedAt)
      .limit(1);

    if (clash?.length) {
      return NextResponse.json(
        {
          error: `${donorName} already has an entry for that amount on that date (${clash[0].receipt_no}). Change the date or amount if this is a second contribution.`,
        },
        { status: 409 },
      );
    }

    const { error } = await supabase.from("donations").insert({
      donor_name: donorName,
      wing: (body.wing ?? "").trim().toUpperCase() || null,
      flat: (body.flat ?? "").trim() || null,
      is_tenant: Boolean(body.isTenant),
      amount,
      method: body.method || "cash",
      reference,
      received_at: receivedAt,
      note: "Recorded by hand",
      activity_id: body.activityId ?? null,
      recorded_by: await committeeMemberId(),
      status: "verified",
      verified_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save the entry." },
      { status: 500 },
    );
  }
}

/**
 * Corrects a contribution — any field, on any row.
 *
 * Amount, date and transaction reference were locked on imported rows, because
 * those are what reconciling against the bank statement rests on. The
 * committee asked for them open: they are the ones who answer for the figures,
 * and a lock they did not want only means the correction happens in the
 * database instead, where nothing records it.
 *
 * The cost is real and stays with them: change an imported amount and the
 * register no longer agrees with the statement it came from, and the next
 * import will not put it back — the duplicate test matches on the reference,
 * which still exists.
 */
export async function PATCH(request: Request) {
  if (!(await authorised(request))) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: "The register isn't reachable." }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Could not read the request." }, { status: 400 });
  }

  const id = (body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "Which contribution?" }, { status: 400 });

  const supabase = admin();
  const { data: existing } = await supabase
    .from("donations")
    .select("id, reference, receipt_no")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "That contribution no longer exists." }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};

  if (body.donorName !== undefined) {
    const name = body.donorName.trim();
    if (!name) {
      return NextResponse.json({ error: "Enter the contributor's name." }, { status: 400 });
    }
    patch.donor_name = name;
  }
  if (body.wing !== undefined) patch.wing = body.wing.trim().toUpperCase() || null;
  if (body.flat !== undefined) patch.flat = body.flat.replace(/\D/g, "") || null;
  if (body.isTenant !== undefined) patch.is_tenant = Boolean(body.isTenant);

  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Amount must be more than zero." }, { status: 400 });
    }
    patch.amount = amount;
  }
  if (body.method !== undefined) patch.method = body.method || "cash";
  if (body.receivedAt !== undefined) patch.received_at = body.receivedAt;
  if (body.reference !== undefined) patch.reference = body.reference.trim() || null;

  const { error } = await supabase.from("donations").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await authorised(request))) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Which entry?" }, { status: 400 });

  const { error } = await admin().from("donations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
