/**
 * The pitch (F0) of a short stretch of speech, one frame every 10 ms. Each frame keeps every period YIN finds
 * plausible (de Cheveigné & Kawahara 2002), and the track is the cheapest path through them (as Praat does): a jump of
 * an octave between neighbouring frames is expensive, so a falling fourth tone is followed all the way down instead of
 * being folded back up, and a quiet stretch is unvoiced only when it really has no clear period.
 * Pure on purpose: the same code draws a learner's line in the browser and checks the generated clips in scripts,
 * so the line a learner sees for a model voice was measured exactly the way their own is.
 */

export type Frame = {
  /** Seconds from the start of the samples (the middle of the analysis window). */
  t: number;
  /** null where the frame is not voiced (silence, a consonant like s or sh, a breath). */
  hz: number | null;
};

const ANALYSIS_RATE = 16000;
// The widest range looked in, for a voice not yet known.
export const MIN_HZ = 65;
export const MAX_HZ = 520;
const HOP_SECONDS = 0.01;
const WINDOW_SECONDS = 0.0125;

// Candidates: shifts whose correlation is above 0.5.
const CANDIDATE_MAX = 0.5;
const CANDIDATES_PER_FRAME = 6;
// Path costs. A candidate costs its dip depth; one at two or three times the period of a nearly as deep dip costs a
// little more, so the true period wins over its multiples (a voice is just as periodic at 2T).
const MULTIPLE_COST = 0.15;
// Unvoiced costs as much as a poor dip in anything louder than near-silence (as in Praat), and nothing in silence.
const UNVOICED_COST = 0.5;
const SILENCE = 0.02; // share of the clip's loudest frame at and below which a frame is silence
const QUIET = 0.04; // from here up unvoiced costs its full price
const OCTAVE_JUMP_COST = 0.8;
const VOICING_CHANGE_COST = 0.2;

// After the path: voiced runs shorter than this are dropped (clicks, a burst of breath), and short runs well above the
// main one (a hiss read as 500 Hz after a word, a stretch of creak read an octave up) too. Runs below it are nearly
// always real (a fourth tone falling on into creak), so only those far below it go.
const MIN_RUN_FRAMES = 4;
const STRAY_RUN_FRAMES = 10;
const STRAY_ABOVE_OCTAVES = 0.6;
const STRAY_BELOW_OCTAVES = 1.3;

/** Averages blocks of samples down to about 16 kHz. Crude as a low-pass, but plenty for finding a voice's pitch. */
export function downsample(samples: Float32Array, rate: number): { x: Float32Array; rate: number } {
  const factor = Math.max(1, Math.round(rate / ANALYSIS_RATE));
  if (factor === 1) return { x: samples, rate };
  const n = Math.floor(samples.length / factor);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let k = 0; k < factor; k++) sum += samples[i * factor + k];
    x[i] = sum / factor;
  }
  return { x, rate: rate / factor };
}

type Candidate = { hz: number; cost: number };
type RawFrame = { t: number; rms: number; candidates: Candidate[] };

/**
 * Each frame's loudness and its plausible pitches, from the normalized cross-correlation of a short window with
 * itself shifted by each candidate period (as in RAPT). Normalizing each shift by the energy of both stretches keeps a
 * fading, fast-falling fourth tone periodic where a plain difference (YIN) loses it; the short window keeps up with it.
 */
function analyse(x: Float32Array, rate: number, floor: number, ceiling: number): RawFrame[] {
  const hop = Math.max(1, Math.round(rate * HOP_SECONDS));
  const tauMin = Math.max(2, Math.floor(rate / ceiling));
  const tauMax = Math.ceil(rate / floor);
  const w = Math.max(16, Math.round(rate * WINDOW_SECONDS));
  // 1 - correlation, so that, as with YIN, the period is a dip toward 0.
  const dist = new Float64Array(tauMax + 2);
  const out: RawFrame[] = [];

  for (let start = 0; start + w + tauMax + 1 < x.length; start += hop) {
    let e0 = 0;
    for (let j = 0; j < w; j++) e0 += x[start + j] * x[start + j];
    // Energy of the shifted window, slid along one sample at a time.
    let eTau = 0;
    for (let j = 0; j < w; j++) eTau += x[start + tauMin - 1 + j] ** 2;
    for (let tau = tauMin - 1; tau <= tauMax + 1; tau++) {
      if (tau > tauMin - 1) eTau += x[start + tau + w - 1] ** 2 - x[start + tau - 1] ** 2;
      let cross = 0;
      for (let j = 0; j < w; j++) cross += x[start + j] * x[start + j + tau];
      const denom = Math.sqrt(e0 * Math.max(eTau, 0));
      dist[tau] = denom > 0 ? 1 - cross / denom : 1;
    }

    const dips: { period: number; depth: number }[] = [];
    for (let tau = tauMin; tau <= tauMax; tau++) {
      const b = dist[tau];
      if (b >= CANDIDATE_MAX || b > dist[tau - 1] || b > dist[tau + 1]) continue;
      // A parabola through the dip and its neighbours puts the period between samples.
      const a = dist[tau - 1];
      const c = dist[tau + 1];
      const denom = a - 2 * b + c;
      const shift = denom !== 0 ? Math.max(-1, Math.min(1, (a - c) / (2 * denom))) : 0;
      dips.push({ period: tau + shift, depth: b });
    }
    const candidates: Candidate[] = dips.map(({ period, depth }) => {
      const multiple = dips.some(
        (d) => d.depth < depth + 0.1 && [2, 3].some((k) => Math.abs((d.period * k) / period - 1) < 0.04),
      );
      return { hz: rate / period, cost: depth + (multiple ? MULTIPLE_COST : 0) };
    });
    candidates.sort((p, q) => p.cost - q.cost);
    out.push({ t: (start + w / 2) / rate, rms: Math.sqrt(e0 / w), candidates: candidates.slice(0, CANDIDATES_PER_FRAME) });
  }
  return out;
}

/** The cheapest path through every frame's candidates (index -1 is unvoiced). */
function cheapestPath(frames: RawFrame[]): (number | null)[] {
  const loudest = Math.max(...frames.map((f) => f.rms), 1e-9);
  const unvoicedCost = frames.map((f) => {
    const share = f.rms / loudest;
    return UNVOICED_COST * Math.max(0, Math.min(1, (share - SILENCE) / (QUIET - SILENCE)));
  });
  // Silence is never voiced, however periodic the hum in it looks.
  const states = frames.map((f) => (f.rms / loudest < SILENCE ? [] : f.candidates));

  let prevCost = [unvoicedCost[0], ...states[0].map((c) => c.cost)];
  const back: number[][] = [];
  for (let i = 1; i < frames.length; i++) {
    const prev = states[i - 1];
    const cur = states[i];
    const cost: number[] = [];
    const from: number[] = [];
    // Unvoiced now.
    {
      let best = prevCost[0];
      let arg = 0;
      for (let k = 0; k < prev.length; k++) {
        const c = prevCost[k + 1] + VOICING_CHANGE_COST;
        if (c < best) [best, arg] = [c, k + 1];
      }
      cost.push(best + unvoicedCost[i]);
      from.push(arg);
    }
    for (const cand of cur) {
      let best = prevCost[0] + VOICING_CHANGE_COST;
      let arg = 0;
      for (let k = 0; k < prev.length; k++) {
        const c = prevCost[k + 1] + OCTAVE_JUMP_COST * Math.abs(Math.log2(cand.hz / prev[k].hz));
        if (c < best) [best, arg] = [c, k + 1];
      }
      cost.push(best + cand.cost);
      from.push(arg);
    }
    back.push(from);
    prevCost = cost;
  }

  let state = prevCost.indexOf(Math.min(...prevCost));
  const path: (number | null)[] = new Array(frames.length).fill(null);
  for (let i = frames.length - 1; i >= 0; i--) {
    path[i] = state === 0 ? null : states[i][state - 1].hz;
    if (i > 0) state = back[i - 1][state];
  }
  return path;
}

function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((p, q) => p - q);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** The value below which `p` (0..1) of the values lie. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, (s.length - 1) * p));
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}

/** Runs of consecutive voiced frames, as [first, last] indexes. */
function voicedRuns(hz: (number | null)[]): [number, number][] {
  const runs: [number, number][] = [];
  let start = -1;
  hz.forEach((v, i) => {
    if (v !== null && start < 0) start = i;
    if (v === null && start >= 0) {
      runs.push([start, i - 1]);
      start = -1;
    }
  });
  if (start >= 0) runs.push([start, hz.length - 1]);
  return runs;
}

/**
 * Splits voiced runs where the pitch leaps more than this between two frames 10 ms apart. Speech never moves that
 * fast (a steep fourth tone falls well under a semitone per frame); a creaky third tone read at twice its pitch does.
 */
const MAX_STEP_SEMITONES = 5;
const BLIP_FRAMES = 6;

export type PitchRange = { floor: number; ceiling: number };

/**
 * Where to look for one voice's pitch, from its own frames measured with the widest range: from three quarters of its
 * first quartile to one and a half times its third (De Looze & Hirst). A second pass inside it no longer mistakes a
 * squeak or a doubled creak for the voice.
 */
export function rangeForVoice(hzValues: number[]): PitchRange {
  if (hzValues.length < 20) return { floor: MIN_HZ, ceiling: MAX_HZ };
  return {
    floor: Math.max(MIN_HZ * 0.85, 0.75 * percentile(hzValues, 0.25)),
    ceiling: Math.min(MAX_HZ * 1.15, 1.5 * percentile(hzValues, 0.75)),
  };
}

/** The pitch track of a clip or a recording, one frame every 10 ms, looked for within `range` when the voice is known. */
export function trackPitch(samples: Float32Array, sampleRate: number, range?: PitchRange): Frame[] {
  const { x, rate } = downsample(samples, sampleRate);
  const raw = analyse(x, rate, range?.floor ?? MIN_HZ, range?.ceiling ?? MAX_HZ);
  if (raw.length === 0) return [];
  const hz = cheapestPath(raw);

  // A leap ends one run and starts another: an unvoiced frame is put in its place.
  for (let i = 1; i < hz.length - 1; i++) {
    const a = hz[i - 1];
    const b = hz[i];
    if (a !== null && b !== null && Math.abs(12 * Math.log2(b / a)) > MAX_STEP_SEMITONES) hz[i] = null;
  }

  let runs = voicedRuns(hz).filter(([a, b]) => {
    if (b - a + 1 >= MIN_RUN_FRAMES) return true;
    for (let i = a; i <= b; i++) hz[i] = null;
    return false;
  });
  if (runs.length > 1) {
    const main = runs.reduce((m, r) => (r[1] - r[0] > m[1] - m[0] ? r : m));
    const mainHz = hz.slice(main[0], main[1] + 1) as number[];
    const top = Math.max(...mainHz);
    const bottom = Math.min(...mainHz);
    runs = runs.filter(([a, b]) => {
      const m = median(hz.slice(a, b + 1) as number[]);
      const stray = Math.log2(m / top) > STRAY_ABOVE_OCTAVES || Math.log2(bottom / m) > STRAY_BELOW_OCTAVES;
      if (b - a + 1 >= STRAY_RUN_FRAMES || !stray) return true;
      for (let i = a; i <= b; i++) hz[i] = null;
      return false;
    });
    // A blip: a short run that sits far from the runs on both sides of it (or its one neighbour).
    runs = runs.filter(([a, b], k) => {
      if (b - a + 1 >= BLIP_FRAMES) return true;
      const ends: [number, number][] = [];
      if (k > 0) ends.push([hz[runs[k - 1][1]] as number, hz[a] as number]);
      if (k < runs.length - 1) ends.push([hz[b] as number, hz[runs[k + 1][0]] as number]);
      const far = ends.length > 0 && ends.every(([p, q]) => Math.abs(12 * Math.log2(q / p)) > MAX_STEP_SEMITONES);
      if (!far) return true;
      for (let i = a; i <= b; i++) hz[i] = null;
      return false;
    });
  }
  // A light smoothing within each run: the median of three.
  const smooth = [...hz];
  for (const [a, b] of runs) {
    for (let i = a + 1; i < b; i++) smooth[i] = median([hz[i - 1] as number, hz[i] as number, hz[i + 1] as number]);
  }
  return raw.map((f, i) => ({ t: f.t, hz: smooth[i] }));
}

/** Semitones above 100 Hz: pitch the way the ear hears it, so a man's and a woman's lines have the same shape. */
export function semitones(hz: number): number {
  return 12 * Math.log2(hz / 100);
}

/** The voiced frames as [seconds, semitones]. */
export function voicedPoints(frames: Frame[]): [number, number][] {
  return frames.flatMap((f) => (f.hz === null ? [] : [[f.t, semitones(f.hz)] as [number, number]]));
}
