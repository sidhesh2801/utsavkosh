import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Creates a login for a committee admin or a volunteer.
 *
 * This runs on the server because creating a user requires the `service_role`
 * key, which bypasses every row-level security policy and must never reach a
 * browser. Note the env var has no `NEXT_PUBLIC_` prefix — that is what keeps
 * Next.js from bundling it into client code.
 *
 * The caller's own admin status is verified here, server-side, from their access
 * token. Nothing about the request body is trusted: a volunteer who forged a
 * call to this route gets a 403.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface Body {
  name?: string;
  email?: string;
  password?: string;
  mobile?: string;
  wing?: string;
  flat?: string;
  role?: "admin" | "volunteer";
}

export async function POST(request: Request) {
  if (!SUPABASE_URL || !ANON_KEY) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }
  if (!SERVICE_KEY) {
    return NextResponse.json(
      {
        error:
          "Adding accounts needs the SUPABASE_SERVICE_ROLE_KEY environment variable. Add it in Vercel → Settings → Environment Variables, then redeploy.",
      },
      { status: 500 },
    );
  }

  // --- who is asking? ---
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: caller, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !caller.user) {
    return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  }

  const { data: callerMember } = await admin
    .from("members")
    .select("role, status")
    .eq("user_id", caller.user.id)
    .maybeSingle();

  if (callerMember?.role !== "admin" || callerMember?.status !== "approved") {
    return NextResponse.json(
      { error: "Only committee admins can add accounts." },
      { status: 403 },
    );
  }

  // --- validate what was asked for ---
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Could not read the request." }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const role = body.role === "admin" ? "admin" : "volunteer";

  if (!name) return NextResponse.json({ error: "Please enter their name." }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Please set a password of at least 8 characters." },
      { status: 400 },
    );
  }

  // --- create the auth user ---
  // email_confirm: true skips the confirmation mail. Supabase's built-in mailer
  // allows only a few messages an hour on the free tier, which would make
  // onboarding thirty volunteers take most of a day.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (createError || !created.user) {
    const message = createError?.message ?? "Could not create the account.";
    return NextResponse.json(
      {
        error: /already been registered|already exists/i.test(message)
          ? "An account with that email already exists."
          : message,
      },
      { status: 400 },
    );
  }

  // --- link it to a member row ---
  const { error: memberError } = await admin.from("members").insert({
    user_id: created.user.id,
    name,
    email,
    mobile: (body.mobile ?? "").trim(),
    wing: (body.wing ?? "").trim().toUpperCase(),
    flat: (body.flat ?? "").trim(),
    role,
    status: "approved",
  });

  if (memberError) {
    // Don't leave an auth user with no member row — they'd be able to sign in
    // and then be told they aren't on the register.
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: memberError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, role, email });
}
