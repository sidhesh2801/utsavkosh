import { NextResponse } from "next/server";
import { GENERATOR_COOKIE, sessionRole } from "@/lib/generator-auth";

/**
 * What this browser is signed in as.
 *
 * The session cookie is httpOnly, so the page cannot read it directly — it has
 * to ask. Used to decide whether to show the ledger's edit controls. Hiding
 * them is only a courtesy: every write is checked again on the server, because
 * a hidden button is not a permission.
 *
 * `authenticated` still means the committee, so every screen that already asks
 * this question keeps its old answer; a volunteer session says so separately.
 */
export async function GET(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${GENERATOR_COOKIE}=([^;]+)`));
  const role = await sessionRole(match?.[1]);
  return NextResponse.json({ authenticated: role === "committee", role });
}
