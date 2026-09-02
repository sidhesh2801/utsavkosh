import { NextResponse, type NextRequest } from "next/server";
import { GENERATOR_COOKIE, isValidSessionToken } from "@/lib/generator-auth";

/**
 * Gate in front of the committee-only pages, and the switch that closes the
 * whole app.
 *
 * Middleware runs before Vercel serves the static file, which is what makes
 * this a real lock rather than a client-side one: an unauthenticated request
 * never receives the page at all, so there is no source to inspect.
 *
 * The serving counter is here for the same reason as the generator: it lists
 * every family with their flat and mobile, and it can mark food as served.
 */
const PROTECTED = ["/receipt-generator.html", "/generator", "/food-counter"];

/**
 * Closing the app for maintenance.
 *
 * Set MAINTENANCE=1 in Vercel and redeploy; unset it and redeploy to reopen.
 * That closes it to everyone, the committee included. Add
 * MAINTENANCE_ALLOW_COMMITTEE=1 if they should still get in.
 *
 * Nothing else changes — the register lives in Supabase, and this only decides
 * whether the app will show it. Every donation, ledger entry, coupon and
 * receipt number is exactly where it was when the app comes back.
 *
 * Deliberately a redeploy rather than something that can be toggled live: a
 * public ledger going dark is not a thing that should be one stray click away.
 */
const CLOSED = process.env.MAINTENANCE === "1" || process.env.MAINTENANCE === "true";

/**
 * Whether a committee session may still pass while the app is closed.
 *
 * Off unless asked for. "Closed" should mean closed to everybody, including
 * the person who closed it — a volunteer whose phone happens to hold a session
 * from last week would otherwise see the app working, conclude the switch had
 * failed, and go looking for a fault that is not there. Set
 * MAINTENANCE_ALLOW_COMMITTEE=1 when the committee needs to keep entering cash
 * behind a closed shopfront.
 */
const LET_COMMITTEE_IN =
  process.env.MAINTENANCE_ALLOW_COMMITTEE === "1" ||
  process.env.MAINTENANCE_ALLOW_COMMITTEE === "true";

/** Reachable while closed, so the committee can sign in when allowed to. */
const ALWAYS_OPEN = LET_COMMITTEE_IN
  ? ["/maintenance.html", "/generator-login", "/api/generator-login", "/api/session"]
  : ["/maintenance.html"];

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = await isValidSessionToken(request.cookies.get(GENERATOR_COOKIE)?.value);

  const passes = LET_COMMITTEE_IN && signedIn;
  if (CLOSED && !passes && !ALWAYS_OPEN.some((p) => pathname.startsWith(p))) {
    // Rewritten, not redirected: the address the resident typed stays in the
    // bar, so reloading once the app reopens lands them where they meant to be.
    // 503 rather than 200 so search engines treat it as temporary and do not
    // drop the pages they already know.
    const page = await fetch(new URL("/maintenance.html", request.url));
    return new NextResponse(await page.text(), {
      status: 503,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "retry-after": "3600",
      },
    });
  }

  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  if (signedIn) return NextResponse.next();

  const login = new URL("/generator-login", request.url);
  // Come back to whatever was asked for once signed in.
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  /**
   * Everything except Next's own build output and the icons, because the
   * maintenance switch has to be able to close the whole app. When it is off,
   * the check above is a string comparison and the request carries on.
   */
  matcher: ["/((?!_next/static|_next/image|favicon|icon|apple-icon|manifest).*)"],
};
