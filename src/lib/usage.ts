"use client";
// How many devices use the app, as ことのね counts it (../hanjaatume/src/util/usage.ts). Only this: the app's name, a
// number made on this device at random (tied to no person and no account), what was done (open: the app opened,
// learn: a rain heard to its end, say: a word said and drawn) and whether the app was opened from the home screen.
// Sent to ことのあめ's Supabase (pl_app_ping, ../polylinga/supabase/migrations/20261103000000_app_usage.sql) with the
// anon key by plain fetch, never through sync.ts's client: a signed-in learner's session does not go with it. Nothing of
// the record, no voice, no name or email. Switched off on 記録とアカウント. A ping that cannot go (offline, no
// Supabase settings) is dropped without a word. Counted only at the public address (NEXT_PUBLIC_SITE_URL) in a build:
// not under npm run dev, nor on Vercel's preview addresses. countsHere is pure: tested in tests/usage.test.mjs.

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://kotonoame-ch.vercel.app";
/** This app's name at ことのあめ. */
const APP = "kotonooto";
// The app's first name (ことのね), as all its keys on the device.
const DEVICE = "kotonone:device";
/** 使われ方の数を送る on 記録とアカウント: "0" when the learner switched it off ("1" or nothing: on). */
export const SEND_USAGE = "kotonone:sendUsage";

export type UsageKind = "open" | "learn" | "say";

/** Whether a ping from `origin` counts: only in a build, and only at the public address `site`. */
export function countsHere(origin: string, site: string, production: boolean): boolean {
  if (production !== true || typeof origin !== "string" || typeof site !== "string") return false;
  try {
    const address = new URL(site).origin;
    // An opaque origin ("null": a file, a sandboxed frame) is nobody's address.
    return address !== "null" && origin === address;
  } catch {
    return false;
  }
}

/** This device's number, made the first time; null when storage refuses (nothing is counted then). */
function deviceId(): string | null {
  try {
    let id = localStorage.getItem(DEVICE);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE, id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Whether the learner lets the counts go (on unless switched off). */
export function sendsUsage(): boolean {
  try {
    return localStorage.getItem(SEND_USAGE) !== "0";
  } catch {
    return true;
  }
}

/** Opened from the icon on the home screen (the manifest's standalone), not in a browser tab. */
function standalone(): boolean {
  try {
    return (
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      (navigator as { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

/** Counts one (not waited for). */
export function countUsage(kind: UsageKind): void {
  if (typeof window === "undefined" || !URL_ || !KEY) return;
  if (!countsHere(location.origin, SITE, process.env.NODE_ENV === "production") || !sendsUsage()) return;
  const device = deviceId();
  if (!device) return;
  fetch(`${URL_}/rest/v1/rpc/pl_app_ping`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_app: APP, p_device: device, p_kind: kind, p_standalone: standalone() }),
    keepalive: true,
  }).catch(() => {
    // Not counted this time.
  });
}
