import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { GENERATOR_COOKIE, type Role, sessionRole } from "@/lib/generator-auth";

/**
 * The photographs volunteers add to the festival collage.
 *
 * The repo folder (`public/collage/`) is still there and still works, but it
 * only works for whoever can push a commit. The people holding the photographs
 * were standing in front of the handi with a phone, so they get a way in that
 * doesn't involve git: the volunteers' password, an upload button, and the
 * picture is on the page.
 *
 * A public bucket, because these go on a page anyone can read and a signed URL
 * that expires is an image that stops loading. That makes the checks below the
 * only thing standing between this and a public file host, which is why they
 * are on size, type and count rather than trusting the form.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const BUCKET = "collage";

/** A phone photo. Anything bigger is a video frame or a mistake. */
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * A ceiling, so one person with a full camera roll cannot turn the thanks page
 * into a thousand-image download for everyone else on mobile data.
 */
const MAX_PHOTOS = 200;

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heic",
};

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

function publicUrl(name: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${name}`;
}

const SIGN_IN = "Sign in as a volunteer to add photos.";

/**
 * Anyone. Listed with the anon key so the bucket's own policy decides, and
 * newest last, so an upload lands at the end of the wall rather than shuffling
 * everything that was already there.
 */
export async function GET() {
  if (!SUPABASE_URL || !ANON_KEY) return NextResponse.json({ photos: [] });

  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.storage.from(BUCKET).list("", {
    limit: MAX_PHOTOS,
    sortBy: { column: "created_at", order: "asc" },
  });

  // A missing bucket means the migration hasn't been run. That should leave
  // the page with the repo's own photos, not an error where the wall was.
  if (error) return NextResponse.json({ photos: [] });

  return NextResponse.json({
    photos: (data ?? [])
      .filter((o) => o.name && !o.name.startsWith("."))
      .map((o) => ({ name: o.name, url: publicUrl(o.name) })),
  });
}

/** Either sign-in. One file per request; the browser sends them one at a time. */
export async function POST(request: Request) {
  if (!(await roleOf(request))) {
    return NextResponse.json({ error: SIGN_IN }, { status: 401 });
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
    return NextResponse.json(
      { error: "That photo is over 10 MB. Send a smaller one." },
      { status: 413 },
    );
  }

  const extension = ALLOWED[file.type];
  if (!extension) {
    return NextResponse.json({ error: "Photos only — JPG, PNG, HEIC or WEBP." }, { status: 415 });
  }

  const db = admin();

  const { data: existing } = await db.storage.from(BUCKET).list("", { limit: MAX_PHOTOS + 1 });
  if ((existing?.length ?? 0) >= MAX_PHOTOS) {
    return NextResponse.json(
      { error: `The collage is full at ${MAX_PHOTOS} photos. Remove one first.` },
      { status: 409 },
    );
  }

  // Timestamp first so the storage listing and the wall agree on the order,
  // and a random tail so two phones uploading in the same second don't collide.
  const name = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;

  const { error } = await db.storage
    .from(BUCKET)
    .upload(name, file, { contentType: file.type, upsert: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, photo: { name, url: publicUrl(name) } });
}

/**
 * Either sign-in, matching the thanks entries: someone who uploaded the wrong
 * picture should be able to take it down in the same visit. Only photographs
 * uploaded through here can be removed — the ones in the repo folder are not
 * in this bucket and are not reachable from this route.
 */
export async function DELETE(request: Request) {
  if (!(await roleOf(request))) {
    return NextResponse.json({ error: SIGN_IN }, { status: 401 });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: "Uploads aren't configured." }, { status: 503 });
  }

  const name = new URL(request.url).searchParams.get("name");
  // No slashes and no dot-dot: the name came off a page, and a path is not a
  // name however convincingly it is spelled.
  if (!name || name.includes("/") || name.includes("..")) {
    return NextResponse.json({ error: "Which photo?" }, { status: 400 });
  }

  const { error } = await admin().storage.from(BUCKET).remove([name]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
