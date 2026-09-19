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
 * Two sign-ins, and they are not the same permission.
 *
 * The committee's opens the money — the receipt generator, the ledger, cash
 * entries. The volunteers' opens one page: the thanks list, so the people who
 * ran the festival can write their own line rather than have the committee
 * write it for them. Sharing the committee password to get that would have
 * handed out the ledger with it.
 *
 * Credentials come from Vercel's environment variables. The fallbacks match
 * what was asked for, but anyone who can reach the URL can guess them — set
 * GENERATOR_USER / GENERATOR_PASSWORD and VOLUNTEER_USER / VOLUNTEER_PASSWORD
 * in Vercel to something private.
 */
export type Role = "committee" | "volunteer";

function credentials() {
  return {
    user: process.env.GENERATOR_USER || "admin",
    password: process.env.GENERATOR_PASSWORD || "admin",
  };
}

function volunteerCredentials() {
  return {
    user: process.env.VOLUNTEER_USER || "volunteer",
    password: process.env.VOLUNTEER_PASSWORD || "volunteer@2026",
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

function matches(user: string, password: string, expected: { user: string; password: string }) {
  // Both compared even when the username is wrong, so the response time
  // doesn't reveal which half was incorrect.
  const userOk = safeEqual(user.trim().toLowerCase(), expected.user.toLowerCase());
  const passOk = safeEqual(password, expected.password);
  return userOk && passOk;
}

/** Which door this pair opens, or none. */
export function checkCredentials(user: string, password: string): Role | null {
  if (matches(user, password, credentials())) return "committee";
  if (matches(user, password, volunteerCredentials())) return "volunteer";
  return null;
}

/**
 * `role.expiry.signature` — enough to prove the server issued it, to whom, and
 * when. The role is inside the signed part, so it cannot be edited upward in
 * the browser.
 */
export async function createSessionToken(role: Role = "committee"): Promise<string> {
  const expires = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  return `${role}.${expires}.${await hmac(`${role}.${expires}`)}`;
}

/** The role this cookie carries, or null if it is absent, stale or forged. */
export async function sessionRole(token: string | undefined): Promise<Role | null> {
  if (!token) return null;
  const parts = token.split(".");

  // Sessions issued before there were two roles are the committee's. Accepted
  // so that nobody signed in when this shipped is thrown out mid-festival.
  const legacy = parts.length === 2;
  const role = legacy ? "committee" : parts[0];
  const expiresRaw = legacy ? parts[0] : parts[1];
  const signature = legacy ? parts[1] : parts[2];
  if (!expiresRaw || !signature) return null;
  if (role !== "committee" && role !== "volunteer") return null;

  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < Date.now()) return null;

  const signed = legacy ? expiresRaw : `${role}.${expiresRaw}`;
  return safeEqual(signature, await hmac(signed)) ? role : null;
}

/**
 * Committee only. Every existing caller means "may touch the money", so a
 * volunteer session deliberately fails this — they get the thanks page and
 * nothing else.
 */
export async function isValidSessionToken(token: string | undefined): Promise<boolean> {
  return (await sessionRole(token)) === "committee";
}

export const SESSION_MAX_AGE = SESSION_HOURS * 60 * 60;
