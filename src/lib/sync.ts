"use client";

// The learner's ことのあめ account: the same Supabase project as ことのあめ, so the same accounts. Signing in is optional;
// when they are signed in, their record (State) is kept in kn_records as well as on the device, read and written from
// the browser as them (RLS: only their own row). Both copies are merged, never overwritten (mergeStates), so using
// the app on a phone and a computer loses nothing. Any failure falls back to the device's copy without a word.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { emptyState, mergeStates, type State } from "./rain-core.ts";
import { clearState, loadState, onSave, saveLocal } from "./store.ts";

const TABLE = "kn_records";
const PUSH_AFTER_MS = 1500;
const PULL_TIMEOUT_MS = 2500;

let client: SupabaseClient | null | undefined;

/** null when the app has no Supabase settings (it then works on the device only). */
export function supabase(): SupabaseClient | null {
  if (client === undefined) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    client =
      url && key && typeof window !== "undefined"
        ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "kotonone-auth" } })
        : null;
  }
  return client;
}

export type Account = { id: string; email: string | null };

/** The signed-in account, from the session kept on the device (no request). */
export async function account(): Promise<Account | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  const user = data.session?.user;
  return user && !user.is_anonymous ? { id: user.id, email: user.email ?? null } : null;
}

const timeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

async function pull(sb: SupabaseClient, id: string): Promise<State | null> {
  const { data, error } = await sb.from(TABLE).select("state").eq("user_id", id).maybeSingle();
  if (error) throw error;
  const state = data?.state as State | undefined;
  return state?.v === 1 ? { ...emptyState(), ...state } : null;
}

async function push(sb: SupabaseClient, id: string, state: State): Promise<void> {
  const { error } = await sb.from(TABLE).upsert({ user_id: id, state, updated_at: new Date().toISOString() });
  if (error) throw error;
}

const same = (a: State, b: State) => JSON.stringify(a) === JSON.stringify(b);

/** The device's record and the account's made one and kept in both; the record to use. The device's on any failure. */
export async function syncRecord(): Promise<State> {
  const local = loadState();
  const sb = supabase();
  const me = await account();
  if (!sb || !me) return local;
  try {
    const remote = await timeout(pull(sb, me.id), PULL_TIMEOUT_MS);
    const merged = remote ? mergeStates(local, remote) : local;
    if (!same(merged, local)) saveLocal(merged);
    if (!remote || !same(merged, remote)) await push(sb, me.id, merged);
    return merged;
  } catch {
    return local;
  }
}

// After a save, the account's copy follows a moment later (a run of answers becomes one write), merged with whatever
// another device may have written meanwhile. Also when the page is hidden (the phone locked, the tab left).
let pending = false;
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush(): Promise<void> {
  if (!pending) return;
  pending = false;
  await syncRecord();
}

if (typeof window !== "undefined") {
  onSave(() => {
    pending = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void flush(), PUSH_AFTER_MS);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
}

export type SignInResult = { ok: true } | { ok: false; reason: "credentials" | "unconfirmed" | "busy" | "failed" | "unavailable" };

/** With the email and password of a ことのあめ account; the record is merged in at once. */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  const sb = supabase();
  if (!sb) return { ok: false, reason: "unavailable" };
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    if (error.status === 429) return { ok: false, reason: "busy" };
    if (error.code === "email_not_confirmed") return { ok: false, reason: "unconfirmed" };
    if (error.code === "invalid_credentials" || error.status === 400) return { ok: false, reason: "credentials" };
    return { ok: false, reason: "failed" };
  }
  await syncRecord();
  return { ok: true };
}

/** With Google (the ID token Google Identity Services gave the page, and the nonce it was made for). */
export async function signInWithGoogle(token: string, nonce: string): Promise<boolean> {
  const sb = supabase();
  if (!sb) return false;
  const { error } = await sb.auth.signInWithIdToken({ provider: "google", token, nonce });
  if (error) return false;
  await syncRecord();
  return true;
}

/** Stops keeping the record in the account; the device keeps its copy. */
export async function signOut(): Promise<void> {
  await flush();
  await supabase()?.auth.signOut();
}

/** 記録を消す: on the device, and in the account too when signed in. */
export async function resetRecord(): Promise<void> {
  clearState();
  const sb = supabase();
  const me = await account();
  if (sb && me) await push(sb, me.id, emptyState()).catch(() => undefined);
}
