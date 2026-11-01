"use client";
// ことのあめでつなぐ: the learner goes to ことのあめ's /connect (logging in or signing up there as they like), says つなぐ,
// and comes back to /login with a one-time sign-in token in the URL's fragment, which signs them in here too
// (sync.ts signInWithKotonoame). A random state, kept on this device before leaving and required back with the token,
// makes sure the token belongs to a つなぐ started in this browser: a link carrying someone else's token cannot sign
// the learner into a stranger's account and send their record into it. ことのあめ sends tokens only to the sisters it
// knows (its src/lib/sisters.ts) at their own addresses, or to this computer while developing.
// The same in every sister but for APP. readReturn is pure: tested in tests/connect.test.mjs.

/** This app's name at ことのあめ. */
export const APP = "kotonooto";
const KEY = "kotonoame-connect";
/** How long a つなぐ may take: a new account's confirmation mail may be opened a while later. */
export const KEEP_MS = 3 * 3_600_000;

export type Pending = { state: string; next: string; at: number };
export type Returned = { token: string; next: string } | { error: "stale" } | null;
export type Finished = { ok: true; next: string } | { ok: false; reason: "stale" | "failed" };

/** What ことのあめ sent back in a fragment, checked against the つなぐ this browser started; null when nothing came. */
export function readReturn(hash: string, pending: Pending | null, now: number): Returned {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const token = params.get("kotonoame");
  if (!token) return null;
  if (!pending || params.get("state") !== pending.state || !(now - pending.at <= KEEP_MS)) return { error: "stale" };
  return { token, next: pending.next };
}

function newState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Off to ことのあめ; `next` (a path here) is where to go once back and signed in. */
export function startConnect(kotonoameUrl: string, next: string): void {
  const state = newState();
  try {
    localStorage.setItem(KEY, JSON.stringify({ state, next, at: Date.now() } satisfies Pending));
  } catch {
    // Without it the token that comes back is refused as stale, and nothing is signed in.
  }
  // Another site (ことのあめ), not a page of this app, so not the router.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  location.assign(`${kotonoameUrl}/connect?${new URLSearchParams({ app: APP, back: location.origin, state })}`);
}

/** What came back, if anything. The fragment and the つなぐ kept here are cleared at once: the token is spent either way. */
function takeReturn(): Returned {
  if (!location.hash.includes("kotonoame=")) return null;
  const hash = location.hash;
  history.replaceState(null, "", location.pathname + location.search);
  let pending: Pending | null = null;
  try {
    pending = JSON.parse(localStorage.getItem(KEY) ?? "null") as Pending | null;
    localStorage.removeItem(KEY);
  } catch {
    pending = null;
  }
  return readReturn(hash, pending, Date.now());
}

let finishing: Promise<Finished> | undefined;

/** Back from ことのあめ and still signing in (the fragment not yet read, or its token being spent). */
export const connectInProgress = () => finishing !== undefined || location.hash.includes("kotonoame=");

/**
 * Signs in with what came back from ことのあめ (null when nothing did). Once per return, however many times the page asks:
 * React runs effects twice while developing, and the token cannot be spent twice.
 */
export function finishConnect(signIn: (token: string) => Promise<boolean>): Promise<Finished> | null {
  if (finishing) return finishing;
  const back = takeReturn();
  if (!back) return null;
  const done: Promise<Finished> =
    "error" in back
      ? Promise.resolve({ ok: false, reason: "stale" })
      : signIn(back.token).then((ok): Finished => (ok ? { ok: true, next: back.next } : { ok: false, reason: "failed" }));
  finishing = done;
  void done.finally(() => setTimeout(() => (finishing = undefined), 0));
  return done;
}
