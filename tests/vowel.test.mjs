import assert from "node:assert/strict";
import { test } from "node:test";
import { trackPitch } from "../src/lib/pitch.ts";
import { frontness, partFor } from "../src/lib/vowel.ts";

/** A voiced vowel at 160 Hz whose harmonics are shaped by resonances (formants) at the given frequencies. */
function vowel(formants, seconds = 0.4, rate = 24000) {
  const n = Math.round(seconds * rate);
  const out = new Float32Array(n);
  const f0 = 160;
  for (let h = 1; f0 * h < 4000; h++) {
    const hz = f0 * h;
    const gain = formants.reduce((g, [f, bw]) => g + 1 / (1 + ((hz - f) / bw) ** 2), 0) / h ** 0.5;
    for (let i = 0; i < n; i++) out[i] += gain * Math.sin((2 * Math.PI * hz * i) / rate);
  }
  const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  for (let i = 0; i < n; i++) out[i] *= (0.3 / peak) * Math.min(1, i / 240, (n - i) / 240);
  return out;
}

test("ü (second formant near 2 kHz) is far more forward than u (second formant near 800 Hz)", () => {
  const u = vowel([[300, 80], [800, 100]]);
  const ü = vowel([[300, 80], [2100, 150]]);
  const fu = frontness(u, 24000, trackPitch(u, 24000));
  const fü = frontness(ü, 24000, trackPitch(ü, 24000));
  assert.ok(fu !== null && fü !== null);
  assert.ok(fü - fu > 15, `ü ${fü.toFixed(1)} dB vs u ${fu.toFixed(1)} dB`);
});

test("a bare u or ü is measured in the middle, a glide at the start", () => {
  assert.equal(partFor("u"), "middle");
  assert.equal(partFor("ü"), "middle");
  assert.equal(partFor("üan"), "start");
  assert.equal(partFor("uan"), "start");
});

test("no voice, no measure", () => {
  assert.equal(frontness(new Float32Array(24000), 24000, trackPitch(new Float32Array(24000), 24000)), null);
});
