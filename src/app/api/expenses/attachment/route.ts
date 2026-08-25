import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { GENERATOR_COOKIE, isValidSessionToken } from "@/lib/generator-auth";

/**
 * The bill or payment screenshot attached to a ledger entry.
 *
 * Uploading is committee-only, or anyone could fill the bucket. Reading is
 * committee-only too, and lives at /api/expenses/[id]/bill — the browser is
 * given an expense id and never the object key, so a resident has nothing to
 * guess at even if the signing ever leaked.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "bills";

/** A phone photo of a bill; anything larger is a mistake, not a bill. */
const MAX_BYTES = 8 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

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

function configured() {
  return SUPABASE_URL && SERVICE_KEY
    ? null
    : NextResponse.json(
        { error: "Attaching a bill needs SUPABASE_SERVICE_ROLE_KEY set in Vercel." },
        { status: 503 },
      );
}

export async function POST(request: Request) {
  if (!(await authorised(request))) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }
  const blocked = configured();
  if (blocked) return blocked;

  let file: File | null = null;
  try {
    const form = await request.formData();
    const entry = form.get("file");
    if (entry instanceof File) file = entry;
  } catch {
    return NextResponse.json({ error: "Could not read the upload." }, { status: 400 });
  }

  if (!file || !file.size) {
    return NextResponse.json({ error: "No file was attached." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "That file is over 8 MB. A photo of the bill is enough." },
      { status: 413 },
    );
  }

  const extension = ALLOWED[file.type];
  if (!extension) {
    return NextResponse.json(
      { error: "Attach a photo (JPG, PNG, HEIC or WEBP) or a PDF." },
      { status: 415 },
    );
  }

  // Named by a random id, never by the vendor or the filename the phone gave
  // it: a guessable key in a private bucket is one signing bug from public.
  const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${extension}`;

  const { error } = await admin()
    .storage.from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ path });
}
