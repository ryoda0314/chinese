import type { CSSProperties } from "react";
import { Easing, interpolate } from "remotion";

export const FPS = 30;

/** 秒 → コマ。 */
export const f = (seconds: number) => Math.round(seconds * FPS);

// アプリの雨：上から降ってきて落ち着く（rain.module.css の fall：cubic-bezier(0.2, 0.8, 0.2, 1)）。
export const FALL = Easing.bezier(0.2, 0.8, 0.2, 1);
export const SOFT = Easing.bezier(0.33, 0, 0.2, 1);

/** `start` から `dur` コマで 0 → 1。 */
export function prog(frame: number, start: number, dur: number, easing: (t: number) => number = FALL): number {
  if (dur <= 0) return frame >= start ? 1 : 0;
  return interpolate(frame, [start, start + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
}

/** 上から降ってくる。 */
export function fall(frame: number, start: number, dist = 18, dur = f(0.55)): CSSProperties {
  const p = prog(frame, start, dur);
  return { opacity: p, transform: `translateY(${(1 - p) * -dist}px)` };
}

/** 少し上がりながら、静かに消える。 */
export function leave(frame: number, start: number, dur = f(0.4), dist = 10): CSSProperties {
  const p = prog(frame, start, dur, SOFT);
  return { opacity: 1 - p, transform: `translateY(${p * -dist}px)` };
}

export const mix = (a: number, b: number, p: number) => a + (b - a) * p;

/** 色から色へ（どちらも #rrggbb）。 */
export function mixColor(a: string, b: string, p: number): string {
  const ca = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const cb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${ca.map((x, i) => Math.round(mix(x, cb[i], p))).join(",")})`;
}
