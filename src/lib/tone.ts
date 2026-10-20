/**
 * Tones as lines. A voice's pitch is put on Chao's five-level scale (1 low … 5 high) using that voice's own range, so a
 * man and a woman, or a learner and a model, can be laid over each other; and a line can be held up against the shape
 * each tone has, to tell which of two words it sounds more like. Pure, shared by the app and the scripts.
 */
import { percentile, semitones, type Frame } from "./pitch.ts";
import type { Tone } from "./pinyin-core.ts";

/** A voice's range in semitones (above 100 Hz): its low and high, about the 5th and 95th percentile of its frames. */
export type Range = { lo: number; hi: number };

/** Range over every voiced frame of many clips: what one voice's 1 and 5 are. */
export function rangeOf(semitoneValues: number[]): Range {
  return { lo: percentile(semitoneValues, 0.05), hi: percentile(semitoneValues, 0.95) };
}

// Where a first tone sits and how low a third tone goes, on the five levels (as in the shapes below).
const FIRST_LEVEL = 4.6;
const THIRD_FLOOR = 1.1;

/**
 * A voice's range from words whose tones are known: its first tones' height is level 4.6, the bottom of its third tones
 * 1.1. Steadier than the spread of all its frames, which a few frames of creak or a doubled pitch can stretch.
 * Falls back to that spread when there are not enough one-syllable first and third tones.
 */
export function rangeFromTones(clips: { tones: Tone[]; semitones: number[] }[]): Range {
  const mono = clips.filter((c) => c.tones.length === 1 && c.semitones.length >= 5);
  const firsts = mono.filter((c) => c.tones[0] === 1).map((c) => percentile(c.semitones, 0.5));
  const thirds = mono.filter((c) => c.tones[0] === 3).map((c) => percentile(c.semitones, 0.1));
  if (firsts.length < 1 || thirds.length < 1) return rangeOf(clips.flatMap((c) => c.semitones));
  const high = percentile(firsts, 0.5);
  const low = percentile(thirds, 0.5);
  const perLevel = Math.max(0.5, (high - low) / (FIRST_LEVEL - THIRD_FLOOR));
  const lo = low - (THIRD_FLOOR - 1) * perLevel;
  return { lo, hi: lo + 4 * perLevel };
}

export function toLevel(st: number, range: Range): number {
  return 1 + (4 * (st - range.lo)) / Math.max(1, range.hi - range.lo);
}

/**
 * A line to draw: `n` evenly spaced points from the first voiced frame to the last, in levels (one decimal), each
 * read between the two frames around it; null inside a gap (a consonant, a break in the voice).
 */
export function lineOf(frames: Frame[], range: Range, n = 40): (number | null)[] {
  const voiced = frames.filter((f) => f.hz !== null);
  if (voiced.length < 2) return [];
  const t0 = voiced[0].t;
  const t1 = voiced[voiced.length - 1].t;
  const step = frames.length > 1 ? frames[1].t - frames[0].t : 0.01;
  const level = (hz: number) => Math.round(toLevel(semitones(hz), range) * 10) / 10;
  const out: (number | null)[] = [];
  let i = 0;
  for (let k = 0; k < n; k++) {
    const t = t0 + ((t1 - t0) * k) / (n - 1);
    while (i < frames.length - 2 && frames[i + 1].t <= t) i++;
    const a = frames[i];
    const b = frames[Math.min(frames.length - 1, i + 1)];
    if (a.hz !== null && b.hz !== null && b.t > a.t) {
      const u = Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
      out.push(level(a.hz * Math.pow(b.hz / a.hz, u)));
    } else if (a.hz !== null && Math.abs(t - a.t) <= step / 2) out.push(level(a.hz));
    else if (b.hz !== null && Math.abs(b.t - t) <= step / 2) out.push(level(b.hz));
    else out.push(null);
  }
  return out;
}

/** Points of a line as [0..1 time, level], gaps left out. */
function linePoints(line: (number | null)[]): [number, number][] {
  const n = line.length;
  return line.flatMap((v, k) => (v === null ? [] : [[n > 1 ? k / (n - 1) : 0, v] as [number, number]]));
}

// The shape of each tone, as [time 0..1 within the syllable, level]. Close to Chao's 55, 35, 214, 51, and to how
// words are really said one at a time (measured on the generated voices): a second tone stays low a while and rises
// late, a third tone dips low and comes back up only at the end of a word (mid-word it only falls, 21), a neutral tone
// takes its height from the tone before it.
type Shape = [number, number][];
function shapeOf(tone: Tone, last: boolean, before: Tone | null): Shape {
  switch (tone) {
    case 1:
      return [[0, 4.6], [1, 4.6]];
    case 2:
      return last ? [[0, 2.8], [0.45, 2.5], [1, 4.6]] : [[0, 2.8], [0.35, 2.6], [1, 4.2]];
    case 3:
      return last ? [[0, 2.4], [0.5, 1.1], [1, 2.6]] : [[0, 2.2], [1, 1.2]];
    case 4:
      return last ? [[0, 4.8], [1, 1.4]] : [[0, 4.8], [1, 2.0]];
    case 5:
      if (before === 1) return [[0, 2.6], [1, 2.2]];
      if (before === 2) return [[0, 3.0], [1, 2.6]];
      if (before === 3) return [[0, 3.4], [1, 3.6]];
      if (before === 4) return [[0, 2.0], [1, 1.4]];
      return [[0, 3], [1, 3]];
  }
}

// A syllable starts near where the one before it ended: this much of the difference is carried over, fading out
// over this much of the syllable.
const CARRY = 0.6;
const CARRY_SPAN = 0.35;

/** How long each syllable takes, relative to the others: a neutral tone is short, a final third tone long. */
function weightOf(tone: Tone, last: boolean): number {
  if (tone === 5) return 0.6;
  if (tone === 3 && last) return 1.25;
  return 1;
}

function at(shape: Shape, u: number): number {
  if (u <= shape[0][0]) return shape[0][1];
  for (let i = 1; i < shape.length; i++) {
    const [t1, v1] = shape[i];
    if (u <= t1) {
      const [t0, v0] = shape[i - 1];
      return v0 + ((v1 - v0) * (u - t0)) / Math.max(1e-6, t1 - t0);
    }
  }
  return shape[shape.length - 1][1];
}

/** Where each syllable starts and ends in the word's 0..1 time. */
type Spans = [number, number][];

/** The level a word's tones (as said) predict at each time 0..1, given where its syllables are. */
function expected(tones: Tone[], spans: Spans): (u: number) => number {
  const n = tones.length;
  const shapes = tones.map((t, i) => shapeOf(t, i === n - 1, i > 0 ? tones[i - 1] : null));
  return (u) => {
    let k = 0;
    while (k < n - 1 && u > (spans[k][1] + spans[k + 1][0]) / 2) k++;
    const [s, e] = spans[k];
    const local = Math.max(0, Math.min(1, (u - s) / Math.max(1e-6, e - s)));
    const own = at(shapes[k], local);
    if (k === 0) return own;
    const carried = at(shapes[k - 1], 1) - at(shapes[k], 0);
    return own + carried * CARRY * Math.max(0, 1 - local / CARRY_SPAN);
  };
}

const SHIFTS = [-0.12, -0.06, 0, 0.06, 0.12];

/**
 * Ways the syllables might be laid out in time: by their usual lengths, moved a little either way; and, for two
 * syllables, around a gap in the line near the middle (a voiceless consonant such as x or sh between them).
 */
function layouts(line: (number | null)[], tones: Tone[]): Spans[] {
  const n = tones.length;
  if (n === 1) return [[[0, 1]]];
  const weights = tones.map((t, i) => weightOf(t, i === n - 1));
  const total = weights.reduce((a, b) => a + b, 0);
  const base = [0];
  for (let i = 0; i < n; i++) base.push(base[i] + weights[i] / total);

  let shiftSets: number[][] = [[]];
  for (let i = 0; i < n - 1; i++) shiftSets = shiftSets.flatMap((s) => SHIFTS.map((x) => [...s, x]));
  const out: Spans[] = shiftSets.map((shift) => {
    const b = [...base];
    for (let i = 1; i < n; i++) b[i] = Math.min(b[i + 1] - 0.05, Math.max(b[i - 1] + 0.05, b[i] + shift[i - 1]));
    return tones.map((_, i) => [b[i], b[i + 1]] as [number, number]);
  });

  if (n === 2) {
    const m = line.length;
    for (let k = 1; k < m - 1; k++) {
      if (line[k] !== null || line[k - 1] === null) continue;
      let end = k;
      while (end < m - 1 && line[end + 1] === null) end++;
      const from = (k - 1) / (m - 1);
      const to = (end + 1) / (m - 1);
      if ((from + to) / 2 > 0.2 && (from + to) / 2 < 0.8) out.push([[0, from], [to, 1]]);
      k = end;
    }
  }
  return out;
}

const MAX_OFFSET = 0.5;
// The worst tenth of the points are left out of the fit: a stray frame of creak or breath should not decide a tone.
const TRIM = 0.1;

/**
 * How far a line is from the shape of these tones: the root mean square gap in levels (0 is a perfect fit).
 * The line may sit a little higher or lower overall (half a level), and the syllables may split a little earlier or
 * later, since neither a voice's range nor its timing is known exactly.
 */
export function distance(line: (number | null)[], tones: Tone[]): number {
  const pts = linePoints(line);
  if (pts.length < 3 || tones.length === 0) return Infinity;
  let best = Infinity;
  for (const spans of layouts(line, tones)) {
    const f = expected(tones, spans);
    const gaps = pts.map(([u, v]) => v - f(u));
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const offset = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, mean));
    const squares = gaps.map((g) => (g - offset) ** 2).sort((a, b) => a - b);
    const kept = squares.slice(0, Math.max(3, Math.ceil(squares.length * (1 - TRIM))));
    const rms = Math.sqrt(kept.reduce((a, s) => a + s, 0) / kept.length);
    if (rms < best) best = rms;
  }
  return best;
}

/** A line with its gaps filled in straight, so two lines with gaps in different places can be compared. */
function filled(line: (number | null)[]): number[] | null {
  const known = line.flatMap((v, k) => (v === null ? [] : [k]));
  if (known.length < 3) return null;
  return line.map((v, k) => {
    if (v !== null) return v;
    const before = [...known].reverse().find((i) => i < k);
    const after = known.find((i) => i > k);
    if (before === undefined) return line[after as number] as number;
    if (after === undefined) return line[before] as number;
    const u = (k - before) / (after - before);
    return (line[before] as number) * (1 - u) + (line[after] as number) * u;
  });
}

const BAND = 0.15;

/**
 * How far apart two lines are (each in its own voice's levels): the mean gap after the best overall shift up or down
 * (at most half a level) and the best small stretch in time (dynamic time warping within 15% of the length).
 * Used to hold a line up against the same word said by other voices, rather than against an idealized shape.
 */
export function lineDistance(a: (number | null)[], b: (number | null)[]): number {
  const fa = filled(a);
  const fb = filled(b);
  if (!fa || !fb) return Infinity;
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const offset = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, mean(fa) - mean(fb)));
  const n = fa.length;
  const m = fb.length;
  const band = Math.max(2, Math.round(BAND * Math.max(n, m)));
  const cost = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(Infinity));
  const steps = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  cost[0][0] = 0;
  for (let i = 1; i <= n; i++) {
    const center = Math.round((i * m) / n);
    for (let j = Math.max(1, center - band); j <= Math.min(m, center + band); j++) {
      const d = Math.abs(fa[i - 1] - offset - fb[j - 1]);
      const options: [number, number][] = [
        [cost[i - 1][j - 1], steps[i - 1][j - 1]],
        [cost[i - 1][j], steps[i - 1][j]],
        [cost[i][j - 1], steps[i][j - 1]],
      ];
      const [c, s] = options.reduce((best, o) => (o[0] < best[0] ? o : best));
      cost[i][j] = c + d;
      steps[i][j] = s + 1;
    }
  }
  return steps[n][m] ? cost[n][m] / steps[n][m] : Infinity;
}

/** Every pattern of full tones for a word of `n` syllables (neutral tones kept where the word has them). */
export function tonePatterns(like: Tone[]): Tone[][] {
  let out: Tone[][] = [[]];
  for (const t of like) {
    const options: Tone[] = t === 5 ? [5] : [1, 2, 3, 4];
    out = out.flatMap((s) => options.map((o) => [...s, o]));
  }
  return out;
}

export type ToneJudgement = {
  /** Distance to the intended tones. */
  target: number;
  /** The best fitting other pattern and its distance. */
  rival: { tones: Tone[]; distance: number };
};

/** How well a line fits the intended tones, against the best fitting other tones a word that long could have. */
export function judgeTones(line: (number | null)[], intended: Tone[]): ToneJudgement {
  const target = distance(line, intended);
  let rival = { tones: intended, distance: Infinity };
  for (const p of tonePatterns(intended)) {
    if (p.every((t, i) => t === intended[i])) continue;
    const d = distance(line, p);
    if (d < rival.distance) rival = { tones: p, distance: d };
  }
  return { target, rival };
}
