/**
 * How far forward a vowel is said: ü (lǜ, nǚ) has its second formant high, near 2 kHz, u (lù, nǔ) low, under 1 kHz.
 * Measured as the energy in a high band against a low band (dB) over the middle of the voiced part. Speech recognizers
 * swap the two in single syllables (路 heard as 绿, 女 as 努, consistently), so this decides u against ü instead,
 * for the generated clips and for a learner alike. Pure.
 */
import { downsample, type Frame } from "./pitch.ts";

const SIZE = 512; // at about 16 kHz: 32 ms
const LOW: [number, number] = [200, 1150];
const HIGH: [number, number] = [1450, 3300];

/** In-place radix-2 FFT of real input; returns the power spectrum (first half). */
function power(frame: Float64Array): Float64Array {
  const n = frame.length;
  const re = Float64Array.from(frame);
  const im = new Float64Array(n);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const xr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
        const xi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
        re[i + k + len / 2] = re[i + k] - xr;
        im[i + k + len / 2] = im[i + k] - xi;
        re[i + k] += xr;
        im[i + k] += xi;
      }
    }
  }
  const out = new Float64Array(n / 2);
  for (let k = 0; k < n / 2; k++) out[k] = re[k] * re[k] + im[k] * im[k];
  return out;
}

/** Where in the voiced part u or ü is heard: the middle for a bare u/ü (路, 绿), the start for a glide (玩 wán, 圆 yuán). */
export type Part = "middle" | "start";
const PARTS: Record<Part, [number, number]> = { middle: [0.3, 0.7], start: [0.0, 0.25] };

/** Which part to measure for a final: u and ü alone are the vowel; uan, üan, uen, ün, üe begin with them. */
export function partFor(final: string): Part {
  return final === "u" || final === "ü" ? "middle" : "start";
}

/**
 * The vowel's frontness in dB (high band over low band) over a part of the voiced frames. null when there is too
 * little voice.
 */
export function frontness(samples: Float32Array, sampleRate: number, frames: Frame[], part: Part = "middle"): number | null {
  const voiced = frames.filter((f) => f.hz !== null);
  if (voiced.length < 6) return null;
  const t0 = voiced[0].t;
  const t1 = voiced[voiced.length - 1].t;
  const from = t0 + (t1 - t0) * PARTS[part][0];
  const to = t0 + (t1 - t0) * PARTS[part][1];
  const { x, rate } = downsample(samples, sampleRate);
  const hann = Array.from({ length: SIZE }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (SIZE - 1)));
  const bin = (hz: number) => Math.round((hz * SIZE) / rate);
  let low = 0;
  let high = 0;
  for (const f of voiced) {
    if (f.t < from || f.t > to) continue;
    const start = Math.round(f.t * rate) - SIZE / 2;
    if (start < 0 || start + SIZE > x.length) continue;
    const frame = new Float64Array(SIZE);
    for (let i = 0; i < SIZE; i++) frame[i] = x[start + i] * hann[i];
    const p = power(frame);
    for (let k = bin(LOW[0]); k <= bin(LOW[1]); k++) low += p[k];
    for (let k = bin(HIGH[0]); k <= Math.min(p.length - 1, bin(HIGH[1])); k++) high += p[k];
  }
  if (low <= 0 || high <= 0) return null;
  return 10 * Math.log10(high / low);
}
