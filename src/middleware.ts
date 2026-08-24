import { NextResponse, type NextRequest } from "next/server";
import { GENERATOR_COOKIE, isValidSessionToken } from "@/lib/generator-auth";

/**
 * Gate in front of the committee-only pages.
 *
 * Middleware runs before Vercel serves the static file, which is what makes
 * this a real lock rather than a client-side one: an unauthenticated request
 * never receives the page at all, so there is no source to inspect.
 *
 * The serving counter is here for the same reason as the generator: it lists
 * every family with their flat and mobile, and it can mark food as served.
 */
const PROTECTED = ["/receipt-generator.html", "/generator", "/food-counter"];

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(GENERATOR_COOKIE)?.value;
  if (await isValidSessionToken(token)) return NextResponse.next();

  const login = new URL("/generator-login", request.url);
  // Come back to whatever was asked for once signed in.
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  /**
   * Only the committee paths. Everything else — the public ledger, the gallery,
   * the activities, and registering for a coupon — stays open to residents
   * without a login, which is the point of the rest of the app.
   */
  matcher: ["/receipt-generator.html", "/generator/:path*", "/food-counter"],
};
