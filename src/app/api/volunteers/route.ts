import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { GENERATOR_COOKIE, type Role, sessionRole } from "@/lib/generator-auth";

/**
 * The volunteers credited on the festival page.
 *
 * Reading is open, because a thank-you nobody can see is not one.
 *
 * Writing needs a sign-in, but not the committee's. There is a second
 * password — `volunteer` — that opens this page and nothing else, so the
 * people who ran the festival can write their own line without being handed
 * the ledger and the receipt generator along with it. What they write is
 * published straight away, and they can edit or remove it themselves; nobody
 * is standing between a volunteer and their own two sentences.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function roleOf(request: Request): Promise<Role | null> {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${GENERATOR_COOKIE}=([^;]+)`));
  return sessionRole(match?.[1]);
}

function admin() {
  return createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const COLUMNS = "id, name, wing, flat, role, note, created_at";

interface Body {
  id?: string;
  name?: string;
  wing?: string;
  flat?: string;
  role?: string;
  note?: string;
}

/** Anyone. Reads with the anon key, so the table's own grants decide. */
export async function GET() {
  if (!SUPABASE_URL || !ANON_KEY) {
    return NextResponse.json({ volunteers: [] });
  }
  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("volunteers")
    .select(COLUMNS)
    .order("created_at")
    .limit(1000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    volunteers: (data ?? []).map((v) => ({
      id: String(v.id),
      name: String(v.name),
      flat: [v.wing, v.flat].filter(Boolean).join("-"),
      role: String(v.role),
      note: v.note ? String(v.note) : "",
    })),
  });
}

const SIGN_IN = "Sign in as a volunteer to write on this page.";

/**
 * Caps. Long enough for two honest sentences and short enough that a shared
 * password cannot be used to publish an essay.
 */
const LIMIT = { name: 60, role: 60, note: 400 };

function parse(body: Body) {
  const name = (body.name ?? "").trim().slice(0, LIMIT.name);
  const role = (body.role ?? "").trim().slice(0, LIMIT.role);
  const flat = (body.flat ?? "").trim().toUpperCase().match(/^([A-Z]*)[-\s]?(\d{3,4})$/);
  return {
    name,
    role,
    wing: (body.wing ?? "").trim().toUpperCase().slice(0, 4) || flat?.[1] || null,
    flat: flat?.[2] ?? (body.flat ?? "").replace(/\D/g, "") ?? null,
    note: (body.note ?? "").trim().slice(0, LIMIT.note) || null,
  };
}

/** Either sign-in. Published immediately — there is no approval step. */
export async function POST(request: Request) {
  if (!(await roleOf(request))) {
    return NextResponse.json({ error: SIGN_IN }, { status: 401 });
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

  const v = parse(body);
  if (!v.name) return NextResponse.json({ error: "Whose name is it?" }, { status: 400 });
  if (!v.role) return NextResponse.json({ error: "What did they help with?" }, { status: 400 });

  const db = admin();

  // The same person twice on a thank-you list reads as carelessness about the
  // very people it is meant to honour.
  const { data: clash } = await db
    .from("volunteers")
    .select("id")
    .eq("name", v.name)
    .eq("role", v.role)
    .maybeSingle();
  if (clash) {
    return NextResponse.json(
      { error: `${v.name} is already credited for that.` },
      { status: 409 },
    );
  }

  const { data: activity } = await db
    .from("activities")
    .select("id")
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await db
    .from("volunteers")
    .insert({ ...v, activity_id: activity?.id ?? null })
    .select(COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, volunteer: data });
}

/** Either sign-in: a volunteer fixing their own wording shouldn't need help. */
export async function PATCH(request: Request) {
  if (!(await roleOf(request))) {
    return NextResponse.json({ error: SIGN_IN }, { status: 401 });
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
  if (!body.id) return NextResponse.json({ error: "Which volunteer?" }, { status: 400 });

  const v = parse(body);
  if (!v.name) return NextResponse.json({ error: "Whose name is it?" }, { status: 400 });
  if (!v.role) return NextResponse.json({ error: "What did they help with?" }, { status: 400 });

  const { error } = await admin().from("volunteers").update(v).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/**
 * Either sign-in. A volunteer who added themselves twice, or who would rather
 * not be listed at all, should not have to find a committee member to undo it.
 */
export async function DELETE(request: Request) {
  if (!(await roleOf(request))) {
    return NextResponse.json({ error: SIGN_IN }, { status: 401 });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: "The register isn't reachable." }, { status: 503 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Which volunteer?" }, { status: 400 });

  const { error } = await admin().from("volunteers").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
