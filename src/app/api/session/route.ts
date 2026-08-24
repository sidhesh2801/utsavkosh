import { NextResponse } from "next/server";
import { GENERATOR_COOKIE, isValidSessionToken } from "@/lib/generator-auth";

/**
 * Whether this browser holds a valid committee session.
 *
 * The session cookie is httpOnly, so the page cannot read it directly — it has
 * to ask. Used to decide whether to show the ledger's edit controls. Hiding
 * them is only a courtesy: every write is checked again on the server, because
 * a hidden button is not a permission.
 */
export async function GET(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${GENERATOR_COOKIE}=([^;]+)`));
  return NextResponse.json({ authenticated: await isValidSessionToken(match?.[1]) });
}
