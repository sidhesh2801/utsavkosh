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
 * What anyone may reach without the committee password.
 *
 * The donations list, the ledger, the volunteers, and a donor's own receipt. Everything else —
 * the home page, the festival pages, the activities, the gallery — needs a
 * sign-in. Hiding the menu items was not enough: a link already shared still
 * opened the page.
 *
 * Anything not listed is sent to /donations rather than refused, which leaves
 * a resident somewhere useful instead of at an error they can do nothing
 * about. The sign-in routes stay open, or the committee could never get in.
 */
const OPEN_TO_ALL = [
  "/donations",
  "/ledger",
  "/volunteers",
  "/api/volunteers",
  "/receipt.html",
  "/generator-login",
  "/maintenance.html",
  "/api/receipts/public",
  "/api/health",
  "/api/generator-login",
  "/api/session",
];

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
 * The value is read per request though, so the redeploy only has to happen —
 * it does not also have to be a cache-busting one.
 */
/**
 * Read per request, not once when the module loads.
 *
 * At module scope the value is fixed when the bundle is built, so removing the
 * variable in Vercel and pressing Redeploy changed nothing: the redeploy reused
 * the cached build with the old value compiled in, and the app stayed shut with
 * no setting left anywhere that explained why.
 */
function isClosed() {
  return process.env.MAINTENANCE === "1" || process.env.MAINTENANCE === "true";
}

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
function letsCommitteeIn() {
  return (
    process.env.MAINTENANCE_ALLOW_COMMITTEE === "1" ||
    process.env.MAINTENANCE_ALLOW_COMMITTEE === "true"
  );
}

/** Reachable while closed, so the committee can sign in when allowed to. */
function alwaysOpen() {
  return letsCommitteeIn()
    ? ["/maintenance.html", "/generator-login", "/api/generator-login", "/api/session"]
    : ["/maintenance.html"];
}

/**
 * Images, fonts and the like.
 *
 * These must stay open however locked down the pages are: the receipt draws
 * the society's artwork and its stamp from /receipt-template.png and
 * /stamp.png, and redirecting those to the donations list left every donor's
 * receipt a blank sheet with the text on it — which is exactly what happened.
 *
 * Only real asset extensions, so an HTML page cannot slip through by name.
 */
const ASSET = /\.(png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|css|js|map|webmanifest|txt|xml)$/i;

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = await isValidSessionToken(request.cookies.get(GENERATOR_COOKIE)?.value);

  const passes = letsCommitteeIn() && signedIn;
  if (isClosed() && !passes && !alwaysOpen().some((p) => pathname.startsWith(p))) {
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

  if (
    !signedIn &&
    !ASSET.test(pathname) &&
    !OPEN_TO_ALL.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return NextResponse.redirect(new URL("/donations", request.url));
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
