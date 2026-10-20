import assert from "node:assert/strict";
import { test } from "node:test";
import { learnerPitchRange, nearer, nearestVoice, remember } from "../src/lib/learner.ts";
import { lineDistance } from "../src/lib/tone.ts";

const ramp = (from, to, n = 40) => Array.from({ length: n }, (_, k) => from + ((to - from) * k) / (n - 1));

test("a line is at no distance from itself, nor from itself a little higher", () => {
  const rise = ramp(2.5, 4.6);
  assert.equal(lineDistance(rise, rise), 0);
  assert.ok(lineDistance(rise, rise.map((v) => v + 0.4)) < 1e-9);
});

test("a little stretch in time costs little; the opposite shape costs a lot", () => {
  const rise = ramp(2.5, 4.6);
  const lateRise = [...Array(6).fill(2.5), ...ramp(2.5, 4.6, 34)];
  const fall = ramp(4.8, 1.4);
  assert.ok(lineDistance(rise, lateRise) < 0.25);
  assert.ok(lineDistance(rise, fall) > 1);
});

test("gaps are bridged, so lines with gaps in different places can be compared", () => {
  const a = ramp(5, 1.5).map((v, k) => (k > 15 && k < 22 ? null : v));
  const b = ramp(5, 1.5).map((v, k) => (k > 25 && k < 30 ? null : v));
  assert.ok(lineDistance(a, b) < 0.1);
});

const word = (lines) => ({ id: "", hanzi: "", pinyin: "", ja: "", lines });

test("nearer: the word whose voices the line is closer to, or neither when it is a toss-up", () => {
  const second = word({ kore: ramp(2.6, 4.6), charon: ramp(2.4, 4.4) });
  const fourth = word({ kore: ramp(4.8, 1.4), charon: ramp(5, 1.6) });
  assert.equal(nearer(ramp(2.5, 4.5), second, fourth).nearer, "a");
  assert.equal(nearer(ramp(4.7, 1.5), second, fourth).nearer, "b");
  assert.equal(nearer(Array(40).fill(3), word({ v: ramp(2, 4) }), word({ v: ramp(4, 2) })).nearer, null);
});

test("the learner's pitch range waits for three recordings, and only the latest twenty are kept", () => {
  assert.equal(learnerPitchRange([10, 11]), undefined);
  const r = learnerPitchRange([10, 11, 12]);
  assert.ok(r.floor < 100 * 2 ** (11 / 12) && r.ceiling > 100 * 2 ** (11 / 12));
  let kept = [];
  for (let i = 0; i < 30; i++) kept = remember(kept, i);
  assert.deepEqual(kept, Array.from({ length: 20 }, (_, i) => i + 10));
  assert.deepEqual(remember([1], null), [1]);
});

test("the model voice drawn beside a learner is the one nearest their pitch", () => {
  const voices = [
    { id: "kore", sex: "f", lo: 4, hi: 18 },
    { id: "charon", sex: "m", lo: -7, hi: 9 },
  ];
  assert.equal(nearestVoice(voices, 0, ["kore", "charon"]), "charon");
  assert.equal(nearestVoice(voices, 12, ["kore", "charon"]), "kore");
  assert.equal(nearestVoice(voices, 0, ["kore"]), "kore");
});
