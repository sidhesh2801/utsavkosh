import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { GENERATOR_COOKIE, isValidSessionToken } from "@/lib/generator-auth";

/**
 * Ledger writes, authorised by the committee session.
 *
 * The committee signs in once — the same password as the receipt generator —
 * and that session governs both. Because that login is the app's own rather
 * than a Supabase Auth account, the write cannot go through row-level
 * security, so it happens here with the service key. Which means every request
 * must be checked before it runs; the client's hidden buttons count for
 * nothing.
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

function guard(request: Request) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json(
      {
        error:
          "Editing the ledger needs the SUPABASE_SERVICE_ROLE_KEY environment variable. Add it in Vercel → Settings → Environment Variables, then redeploy.",
      },
      { status: 503 },
    );
  }
  void request;
  return null;
}

/** Whoever the ledger entries get attributed to. */
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
  title?: string;
  category?: string;
  amount?: number;
  vendor?: string;
  billNo?: string;
  paidAt?: string;
  method?: string;
  note?: string;
  activityId?: string | null;
}

export async function POST(request: Request) {
  if (!(await authorised(request))) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }
  const blocked = guard(request);
  if (blocked) return blocked;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Could not read the request." }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  const amount = Number(body.amount);
  if (!title) {
    return NextResponse.json({ error: "Describe what the money was spent on." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be more than zero." }, { status: 400 });
  }

  try {
    const { error } = await admin()
      .from("expenses")
      .insert({
        title,
        category: body.category || "miscellaneous",
        amount,
        vendor: (body.vendor ?? "").trim() || null,
        bill_no: (body.billNo ?? "").trim() || null,
        paid_at: body.paidAt || new Date().toISOString().slice(0, 10),
        method: body.method || "upi",
        note: (body.note ?? "").trim() || null,
        activity_id: body.activityId ?? null,
        recorded_by: await committeeMemberId(),
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

export async function DELETE(request: Request) {
  if (!(await authorised(request))) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }
  const blocked = guard(request);
  if (blocked) return blocked;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Which entry?" }, { status: 400 });

  const { error } = await admin().from("expenses").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
