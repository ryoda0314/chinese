/**
 * The learner's own voice: where to look for its pitch, how to put it on the five levels, and which of two words a line
 * they said is nearer to. Pure; the estimates themselves are kept on the device (State.voice in rain-core.ts).
 */
import type { Line, VoiceInfo, WordData } from "./data.ts";
import { MAX_HZ, MIN_HZ, semitones, voicedPoints, type Frame, type PitchRange } from "./pitch.ts";
import { lineDistance, type Range } from "./tone.ts";

const KEEP = 20;
// Undecided when the two words are this close to equally near.
const UNDECIDED = 0.05;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN;
};

/** How many semitones one level is, for a learner: the model voices' own, so a narrow voice shows as a flat line. */
export function spanOf(voices: VoiceInfo[]): number {
  return median(voices.map((v) => v.hi - v.lo)) || 14;
}

/** Where the learner's level 3 is, from their recordings so far; null before the first. */
export function learnerCenter(estimates: number[]): number | null {
  return estimates.length ? median(estimates) : null;
}

/** The levels to draw a learner's line on: centred on their level 3, as wide as the model voices. */
export function learnerLevels(center: number, span: number): Range {
  return { lo: center - span / 2, hi: center + span / 2 };
}

/**
 * One recording's estimate of the learner's level 3: its middle pitch, moved by how high the word sits for the model
 * voices (a first tone sits high, so saying 汤 says little about where a learner's middle is).
 */
export function centerEstimate(frames: Frame[], word: WordData, span: number): number | null {
  const st = voicedPoints(frames).map(([, s]) => s);
  if (st.length < 5) return null;
  const levels = Object.values(word.lines).flatMap((l) => l.filter((v): v is number => v !== null));
  const wordMean = levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : 3;
  return median(st) - ((wordMean - 3) * span) / 4;
}

/** Adds an estimate, keeping the latest ones. */
export function remember(estimates: number[], estimate: number | null): number[] {
  return estimate === null ? estimates : [...estimates, estimate].slice(-KEEP);
}

/**
 * Where to look for the learner's pitch once a few recordings are in: well around their middle (a creaky third tone
 * goes far below it, a rising second tone well above). Until then, the widest range.
 */
export function learnerPitchRange(estimates: number[]): PitchRange | undefined {
  if (estimates.length < 3) return undefined;
  const centerHz = 100 * Math.pow(2, (learnerCenter(estimates) as number) / 12);
  return { floor: Math.max(MIN_HZ * 0.85, centerHz * 0.5), ceiling: Math.min(MAX_HZ * 1.15, centerHz * 2.2) };
}

/** The model voice nearest the learner's own pitch, to draw beside their line. */
export function nearestVoice(voices: VoiceInfo[], center: number | null, available: string[]): string {
  const usable = voices.filter((v) => available.includes(v.id));
  if (!usable.length) return available[0];
  if (center === null) return usable[0].id;
  return usable.reduce((best, v) => (Math.abs((v.lo + v.hi) / 2 - center) < Math.abs((best.lo + best.hi) / 2 - center) ? v : best)).id;
}

/** How near a line is to each of two words, as said by every model voice (the median), and which is nearer. */
export function nearer(line: Line, a: WordData, b: WordData): { a: number; b: number; nearer: "a" | "b" | null } {
  const d = (w: WordData) => median(Object.values(w.lines).map((l) => lineDistance(line, l)).filter(Number.isFinite));
  const da = d(a);
  const db = d(b);
  if (!Number.isFinite(da) || !Number.isFinite(db) || Math.abs(da - db) < UNDECIDED) return { a: da, b: db, nearer: null };
  return { a: da, b: db, nearer: da < db ? "a" : "b" };
}

export { semitones };
