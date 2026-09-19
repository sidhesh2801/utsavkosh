import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { GENERATOR_COOKIE, sessionRole } from "@/lib/generator-auth";

/**
 * A volunteer's own picture, for beside their name.
 *
 * Uploads only. It hands back a URL, which the sheet then saves onto the
 * volunteer row along with the name and the note — so a half-finished form
 * leaves an orphan image in a bucket rather than a half-written credit on a
 * page anyone can read.
 *
 * Its own bucket rather than a folder in the collage, so that listing the wall
 * cannot accidentally hang forty portraits on it.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "faces";

/** A headshot off a phone. Nothing here needs to be bigger. */
const MAX_BYTES = 8 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heic",
};

export async function POST(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${GENERATOR_COOKIE}=([^;]+)`));
  if (!(await sessionRole(match?.[1]))) {
    return NextResponse.json(
      { error: "Sign in as a volunteer to add a photo." },
      { status: 401 },
    );
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: "Uploads aren't configured." }, { status: 503 });
  }

  let file: File | null = null;
  try {
    const entry = (await request.formData()).get("file");
    if (entry instanceof File) file = entry;
  } catch {
    return NextResponse.json({ error: "Could not read the upload." }, { status: 400 });
  }

  if (!file || !file.size) {
    return NextResponse.json({ error: "No photo was attached." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That photo is over 8 MB." }, { status: 413 });
  }

  const extension = ALLOWED[file.type];
  if (!extension) {
    return NextResponse.json({ error: "Photos only — JPG, PNG, HEIC or WEBP." }, { status: 415 });
  }

  // Named by a random id, not by the volunteer: the bucket is public, and a
  // file called `anita-sharma.jpg` is a name published whether or not the row
  // saving it ever gets written.
  const name = `${crypto.randomUUID()}.${extension}`;

  const { error } = await createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
    .storage.from(BUCKET)
    .upload(name, file, { contentType: file.type, upsert: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${name}`,
  });
}
