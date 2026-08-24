import { NextResponse } from "next/server";
import { GENERATOR_COOKIE, isValidSessionToken } from "@/lib/generator-auth";

/**
 * Reports which configuration the server can actually see.
 *
 * Names and lengths only — never a value. Exists because a variable can be
 * present in the hosting dashboard and still not reach the code (a typo in the
 * name, the wrong environment, added after the last build), and guessing which
 * of those it is wastes more time than asking.
 *
 * Behind the committee session, because even the shape of the configuration is
 * not a visitor's business.
 */
export async function GET(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${GENERATOR_COOKIE}=([^;]+)`));
  if (!(await isValidSessionToken(match?.[1]))) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  const interesting = Object.keys(process.env)
    .filter((k) => /SUPA|ANON|SERVICE|GENERATOR/i.test(k))
    .sort();

  return NextResponse.json({
    // Exactly what the code looks for.
    expected: {
      NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
    // Every related name the server can see, so a misspelling is obvious.
    namesPresent: interesting,
    // Lengths confirm a value isn't empty, without revealing it.
    lengths: Object.fromEntries(
      interesting.map((k) => [k, (process.env[k] ?? "").length]),
    ),
  });
}
