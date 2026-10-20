import assert from "node:assert/strict";
import { test } from "node:test";
import { trackPitch } from "../src/lib/pitch.ts";
import { distance, judgeTones, lineOf, rangeOf } from "../src/lib/tone.ts";

/** A buzzy voice-like tone (harmonics falling off) whose pitch follows f(t), with silence before and after. */
function voice(f, seconds, rate = 24000, pad = 0.15) {
  const n = Math.round((seconds + 2 * pad) * rate);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate - pad;
    if (t < 0 || t > seconds) continue;
    const hz = f(t / seconds);
    phase += (2 * Math.PI * hz) / rate;
    let s = 0;
    for (let h = 1; h <= 8; h++) s += Math.sin(h * phase) / h;
    const env = Math.min(1, t / 0.02, (seconds - t) / 0.02);
    out[i] = 0.3 * env * s;
  }
  return out;
}

const voicedHz = (frames) => frames.flatMap((f) => (f.hz === null ? [] : [f.hz]));

test("a steady pitch is found, and the silence around it is not voiced", () => {
  for (const hz of [90, 140, 220, 330]) {
    const frames = trackPitch(voice(() => hz, 0.5), 24000);
    const found = voicedHz(frames);
    assert.ok(found.length > 35, `${hz} Hz: ${found.length} voiced frames`);
    // Inside the voice, within 2%; the frames straddling its start and end, within 4% (under half a semitone).
    found.forEach((v, i) => {
      const edge = i < 2 || i >= found.length - 2;
      assert.ok(Math.abs(v / hz - 1) < (edge ? 0.04 : 0.02), `${hz} Hz read as ${v.toFixed(1)} (frame ${i})`);
    });
    assert.equal(frames[0].hz, null);
    assert.equal(frames.at(-1).hz, null);
  }
});

test("a gliding pitch is followed at 48 kHz too", () => {
  const frames = trackPitch(voice((u) => 120 + 100 * u, 0.6, 48000), 48000);
  const found = frames.filter((f) => f.hz !== null);
  const first = found[2].hz;
  const last = found.at(-3).hz;
  assert.ok(first < 135 && last > 205, `${first.toFixed(0)} → ${last.toFixed(0)}`);
});

// Four syllables in one voice, shaped like the four tones in a 200 Hz centred range.
const SHAPES = {
  1: () => 260,
  2: (u) => 190 + (u < 0.3 ? -10 * u : 90 * (u - 0.3)),
  3: (u) => (u < 0.55 ? 175 - 75 * (u / 0.55) : 100 + 60 * ((u - 0.55) / 0.45)),
  4: (u) => 275 - 155 * u,
};

test("lines of the four tones fit their own tone best", () => {
  const tracks = Object.fromEntries(Object.entries(SHAPES).map(([t, f]) => [t, trackPitch(voice(f, 0.45), 24000)]));
  const all = Object.values(tracks).flatMap((fr) => voicedHz(fr).map((hz) => 12 * Math.log2(hz / 100)));
  const range = rangeOf(all);
  for (const [t, frames] of Object.entries(tracks)) {
    const line = lineOf(frames, range);
    const judged = judgeTones(line, [Number(t)]);
    assert.ok(
      judged.target < judged.rival.distance,
      `tone ${t}: ${judged.target.toFixed(2)} vs ${judged.rival.tones} ${judged.rival.distance.toFixed(2)}`,
    );
  }
  // 2 against 3 in particular, by a clear margin.
  const two = lineOf(tracks[2], range);
  assert.ok(distance(two, [3]) - distance(two, [2]) > 0.5);
});
