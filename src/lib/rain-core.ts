/**
 * Which rain falls next, which pairs are in it, the order they are asked in, and what the learner's answers leave
 * behind. Pure, so it can be tested; the learner's record lives on their device (src/lib/store.ts).
 *
 * A rain is one difference (2声と3声, -n と -ng …). A pair the learner mixed up is owed: it comes back after
 * RETURN_DAYS days or RETURN_RAINS other rains, whichever comes first, in a rain of its own difference, and stops being
 * owed once they tell it apart in a later rain. Nothing is ever forced; there is no score.
 */
import type { FamilyData, PairData } from "./data.ts";
import type { FamilyId } from "./i18n/ja.ts";
import { mergeLogs, type Log } from "./log-core.ts";

export const DAY = 86_400_000;
export const RETURN_DAYS = 1;
export const RETURN_RAINS = 3;
export const PAIRS_PER_RAIN = 6;

// New differences in this order: an easy one first, then the hardest, then tones and sounds taking turns.
export const ORDER: FamilyId[] = ["t14", "t23", "asp", "t12", "nng", "t34", "retro", "t24", "t13", "pal", "uv", "tw", "rl", "fh", "ouuo"];

// How well a difference is heard, as a running average of answers (never shown as a number). Below LOW at the end
// of a rain it is still mixed; when it later reaches SPLIT, the day is kept: the day it started to sound different.
const ALPHA = 0.15;
const LOW = 0.75;
const SPLIT = 0.9;

export type PairState = { family: FamilyId; seen: number; missed: number; owed?: boolean; lastMissAt?: number; lastMissRain?: number };
export type FamilyState = { rains: number; lastAt: number; lastRain: number; heard: number; mixed?: boolean; splitAt?: number };
export type State = {
  v: 1;
  rains: number;
  lastFamily?: FamilyId;
  families: Partial<Record<FamilyId, FamilyState>>;
  pairs: Record<string, PairState>;
  /** The learner's own pitch, one estimate per recording (semitones above 100 Hz at their level 3). */
  voice: number[];
  /** What they did, for looking back (src/lib/log-core.ts). Absent in records made before it existed. */
  log?: Log;
};

export const emptyState = (): State => ({ v: 1, rains: 0, families: {}, pairs: {}, voice: [] });

export const pairKey = (p: PairData) => `${p.a}+${p.b}`;

const familyOf = (state: State, id: FamilyId): FamilyState =>
  state.families[id] ?? { rains: 0, lastAt: 0, lastRain: 0, heard: 0.5 };

/** An owed pair whose time to come back has come. */
export function isDue(p: PairState | undefined, rains: number, now: number): boolean {
  if (!p?.owed) return false;
  return now - (p.lastMissAt ?? 0) >= RETURN_DAYS * DAY || rains - (p.lastMissRain ?? 0) >= RETURN_RAINS;
}

/**
 * The next difference: one with pairs due to come back (the longest waiting first), else the next new one,
 * else the one heard least well. Never the one that just fell, while there is another.
 */
export function nextFamily(state: State, available: FamilyId[], now: number): FamilyId {
  const others = available.filter((id) => id !== state.lastFamily);
  const pool = others.length ? others : available;

  const waiting = new Map<FamilyId, number>();
  for (const p of Object.values(state.pairs)) {
    if (!pool.includes(p.family) || !isDue(p, state.rains, now)) continue;
    waiting.set(p.family, Math.min(waiting.get(p.family) ?? Infinity, p.lastMissAt ?? 0));
  }
  if (waiting.size) return [...waiting].sort((a, b) => a[1] - b[1])[0][0];

  const fresh = ORDER.find((id) => pool.includes(id) && familyOf(state, id).rains === 0);
  if (fresh) return fresh;

  return [...pool].sort((a, b) => {
    const fa = familyOf(state, a);
    const fb = familyOf(state, b);
    return fa.heard - fb.heard || fa.lastAt - fb.lastAt;
  })[0];
}

/** Fisher–Yates with the given random source. */
export function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The pairs of one rain: those due back first (up to half), then ones not met yet, then the least met. */
export function pickPairs(state: State, family: FamilyData, now: number, random: () => number, n = PAIRS_PER_RAIN): PairData[] {
  const playable = family.pairs.filter((p) => hasVoices(family, p.a) && hasVoices(family, p.b));
  const seen = (p: PairData) => state.pairs[pairKey(p)]?.seen ?? 0;
  const due = shuffle(playable.filter((p) => isDue(state.pairs[pairKey(p)], state.rains, now)), random).slice(0, Math.ceil(n / 2));
  const rest = shuffle(playable.filter((p) => !due.includes(p)), random).sort((a, b) => seen(a) - seen(b));
  return shuffle([...due, ...rest].slice(0, n), random);
}

const hasVoices = (family: FamilyData, id: string) => Object.keys(family.words[id]?.lines ?? {}).length > 0;

export type Trial = { pair: PairData; answer: "a" | "b"; voice: string };

/**
 * The questions of 聞き分ける: each pair twice, once for each of its words, in an order that never asks the same
 * pair twice running; each in a voice that has the word, not the voice of the question before when there is a choice.
 */
export function makeTrials(pairs: PairData[], family: FamilyData, random: () => number): Trial[] {
  const items = pairs.flatMap((pair) => [
    { pair, answer: "a" as const },
    { pair, answer: "b" as const },
  ]);
  let order = shuffle(items, random);
  for (let tries = 0; tries < 50 && order.some((t, i) => i > 0 && t.pair === order[i - 1].pair); tries++) {
    order = shuffle(items, random);
  }
  let last = "";
  return order.map((t) => {
    const id = t.answer === "a" ? t.pair.a : t.pair.b;
    const voices = Object.keys(family.words[id].lines);
    const options = voices.length > 1 ? voices.filter((v) => v !== last) : voices;
    last = options[Math.floor(random() * options.length)];
    return { ...t, voice: last };
  });
}

/** One answer in 聞き分ける. */
export function recordAnswer(state: State, family: FamilyId, pair: PairData, right: boolean, now: number): State {
  const key = pairKey(pair);
  const p: PairState = state.pairs[key] ? { ...state.pairs[key] } : { family, seen: 0, missed: 0 };
  p.seen++;
  if (!right) {
    p.missed++;
    p.owed = true;
    p.lastMissAt = now;
    p.lastMissRain = state.rains;
  } else if (p.owed && (p.lastMissRain ?? 0) < state.rains) {
    p.owed = false;
  }
  const f = { ...familyOf(state, family) };
  f.heard += ALPHA * ((right ? 1 : 0) - f.heard);
  return { ...state, pairs: { ...state.pairs, [key]: p }, families: { ...state.families, [family]: f } };
}

/** The end of a rain's 聞き分ける. `split` is true the one time a difference that was mixed now sounds apart. */
export function finishRain(state: State, family: FamilyId, now: number): { state: State; split: boolean } {
  const f = { ...familyOf(state, family) };
  const rains = state.rains + 1;
  f.rains++;
  f.lastAt = now;
  f.lastRain = rains;
  let split = false;
  if (f.heard < LOW) f.mixed = true;
  else if (f.mixed && !f.splitAt && f.heard >= SPLIT && f.rains >= 2) {
    f.splitAt = now;
    split = true;
  }
  return { state: { ...state, rains, lastFamily: family, families: { ...state.families, [family]: f } }, split };
}

/** Pairs of a difference that will come back. */
export function owedPairs(state: State, family: FamilyData): PairData[] {
  return family.pairs.filter((p) => state.pairs[pairKey(p)]?.owed);
}

/**
 * Two records of the same learner made one (this device's and the account's), so that nothing either has is lost:
 * counts take the larger, a difference's running average and a pair's owed state come from the record that met it
 * last (or more), and the day a difference started to sound apart is the earlier of the two.
 */
export function mergeStates(a: State, b: State): State {
  const families: State["families"] = {};
  for (const id of new Set([...Object.keys(a.families), ...Object.keys(b.families)]) as Set<FamilyId>) {
    const x = a.families[id];
    const y = b.families[id];
    if (!x || !y) {
      families[id] = { ...((x ?? y) as FamilyState) };
      continue;
    }
    const later = y.lastAt > x.lastAt ? y : x;
    const splits = [x.splitAt, y.splitAt].filter((v): v is number => v !== undefined);
    families[id] = {
      rains: Math.max(x.rains, y.rains),
      lastAt: Math.max(x.lastAt, y.lastAt),
      lastRain: Math.max(x.lastRain, y.lastRain),
      heard: later.heard,
      ...(x.mixed || y.mixed ? { mixed: true } : {}),
      ...(splits.length ? { splitAt: Math.min(...splits) } : {}),
    };
  }
  const pairs: State["pairs"] = {};
  for (const key of new Set([...Object.keys(a.pairs), ...Object.keys(b.pairs)])) {
    const x = a.pairs[key];
    const y = b.pairs[key];
    if (!x || !y) {
      pairs[key] = { ...((x ?? y) as PairState) };
      continue;
    }
    const later = y.seen > x.seen || (y.seen === x.seen && (y.lastMissAt ?? 0) > (x.lastMissAt ?? 0)) ? y : x;
    pairs[key] = { ...later, seen: Math.max(x.seen, y.seen), missed: Math.max(x.missed, y.missed) };
  }
  const later = b.rains > a.rains ? b : a;
  return {
    v: 1,
    rains: Math.max(a.rains, b.rains),
    ...(later.lastFamily ? { lastFamily: later.lastFamily } : {}),
    families,
    pairs,
    voice: b.voice.length > a.voice.length ? b.voice : a.voice,
    ...(a.log || b.log ? { log: mergeLogs(a.log, b.log) } : {}),
  };
}
