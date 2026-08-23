/**
 * Access control for the receipt generator.
 *
 * The check happens on the server, so the password never reaches the browser
 * and "View Source" reveals nothing. That is the whole reason this isn't a
 * password baked into the HTML file — a client-side check on a static page can
 * be read by anyone in ten seconds.
 *
 * Uses Web Crypto rather than node:crypto because this runs in middleware on
 * the Edge runtime, where node built-ins aren't available.
 */

/** How long a sign-in lasts before the volunteer has to enter it again. */
const SESSION_HOURS = 12;

export const GENERATOR_COOKIE = "generator_session";

/**
 * Credentials come from Vercel's environment variables. The fallbacks match
 * what was asked for, but anyone who can reach the URL can guess them — set
 * GENERATOR_USER and GENERATOR_PASSWORD in Vercel to something private.
 */
function credentials() {
  return {
    user: process.env.GENERATOR_USER || "admin",
    password: process.env.GENERATOR_PASSWORD || "admin",
  };
}

/**
 * Secret used to sign session cookies.
 *
 * Derived from the password when none is configured, so that changing the
 * password automatically invalidates every existing session — otherwise
 * someone signed in under the old password would stay signed in.
 */
function secret(): string {
  return process.env.GENERATOR_SECRET || `utsavkosh:${credentials().password}`;
}

async function hmac(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Compares in constant time, so a wrong password can't be found by timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function checkCredentials(user: string, password: string): boolean {
  const expected = credentials();
  // Both compared even when the username is wrong, so the response time
  // doesn't reveal which half was incorrect.
  const userOk = safeEqual(user.trim().toLowerCase(), expected.user.toLowerCase());
  const passOk = safeEqual(password, expected.password);
  return userOk && passOk;
}

/** `expiry.signature` — enough to prove the server issued it, and when. */
export async function createSessionToken(): Promise<string> {
  const expires = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  return `${expires}.${await hmac(String(expires))}`;
}

export async function isValidSessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [expiresRaw, signature] = token.split(".");
  if (!expiresRaw || !signature) return false;

  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;

  return safeEqual(signature, await hmac(expiresRaw));
}

export const SESSION_MAX_AGE = SESSION_HOURS * 60 * 60;
