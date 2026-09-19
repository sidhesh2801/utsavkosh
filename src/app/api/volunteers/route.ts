import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { GENERATOR_COOKIE, isValidSessionToken } from "@/lib/generator-auth";

/**
 * The volunteers credited on the festival page.
 *
 * Reading is open, because a thank-you nobody can see is not one. Writing is
 * the committee's: anyone could otherwise add themselves, and a credits page
 * that can be self-served stops meaning anything.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

function parse(body: Body) {
  const name = (body.name ?? "").trim();
  const role = (body.role ?? "").trim();
  const flat = (body.flat ?? "").trim().toUpperCase().match(/^([A-Z]*)[-\s]?(\d{3,4})$/);
  return {
    name,
    role,
    wing: (body.wing ?? "").trim().toUpperCase() || flat?.[1] || null,
    flat: flat?.[2] ?? (body.flat ?? "").replace(/\D/g, "") ?? null,
    note: (body.note ?? "").trim() || null,
  };
}

export async function POST(request: Request) {
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
  if (!body.id) return NextResponse.json({ error: "Which volunteer?" }, { status: 400 });

  const v = parse(body);
  if (!v.name) return NextResponse.json({ error: "Whose name is it?" }, { status: 400 });
  if (!v.role) return NextResponse.json({ error: "What did they help with?" }, { status: 400 });

  const { error } = await admin().from("volunteers").update(v).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await authorised(request))) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
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
