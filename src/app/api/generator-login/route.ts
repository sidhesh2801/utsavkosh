import { NextResponse } from "next/server";
import {
  GENERATOR_COOKIE,
  SESSION_MAX_AGE,
  checkCredentials,
  createSessionToken,
} from "@/lib/generator-auth";

/**
 * Verifies the receipt generator's password on the server and issues a signed
 * session cookie. The password itself never travels to the browser.
 */
export async function POST(request: Request) {
  let body: { user?: string; password?: string };
  try {
    body = (await request.json()) as { user?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Could not read the request." }, { status: 400 });
  }

  if (!checkCredentials(body.user ?? "", body.password ?? "")) {
    // Deliberately vague: don't reveal which half was wrong.
    return NextResponse.json(
      { error: "That username and password don't match." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(GENERATOR_COOKIE, await createSessionToken(), {
    httpOnly: true, // not readable by scripts, so an injected script can't steal it
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}

/** Sign out. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(GENERATOR_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
