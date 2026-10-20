import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DAY,
  emptyState,
  finishRain,
  isDue,
  makeTrials,
  nextFamily,
  pairKey,
  pickPairs,
  recordAnswer,
} from "../src/lib/rain-core.ts";

const now = new Date("2026-10-19T12:00:00Z").getTime();
const seq = (...xs) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

const word = (id, voices = ["kore", "charon"]) => ({ id, hanzi: id, pinyin: "", ja: "", lines: Object.fromEntries(voices.map((v) => [v, [3, 3, 3]])) });
const family = (id, n) => {
  const pairs = Array.from({ length: n }, (_, i) => ({ a: `${id}a${i}`, b: `${id}b${i}`, at: [0] }));
  const words = Object.fromEntries(pairs.flatMap((p) => [[p.a, word(p.a)], [p.b, word(p.b)]]));
  return { id, pairs, words, sentences: {} };
};
const available = (...fams) => fams.map((f) => f.id);

test("new differences come in order, never the one that just fell", () => {
  const t14 = family("t14", 8);
  const t23 = family("t23", 8);
  let state = emptyState();
  assert.equal(nextFamily(state, available(t14, t23), now), "t14");
  state = finishRain(state, "t14", now).state;
  assert.equal(nextFamily(state, available(t14, t23), now), "t23");
});

test("a mixed-up pair comes back after a day or three other rains, whichever first", () => {
  const t14 = family("t14", 8);
  const t23 = family("t23", 8);
  const asp = family("asp", 8);
  let state = recordAnswer(emptyState(), "t23", t23.pairs[0], false, now);
  state = finishRain(state, "t23", now).state;
  assert.equal(isDue(state.pairs[pairKey(t23.pairs[0])], state.rains, now), false);
  assert.equal(isDue(state.pairs[pairKey(t23.pairs[0])], state.rains, now + DAY), true);
  // Three other rains the same day.
  for (const f of ["t14", "asp", "t14"]) state = finishRain(state, f, now).state;
  assert.equal(nextFamily(state, available(t14, t23, asp), now), "t23");
});

test("an owed pair is let go once told apart in a later rain, not in the same one", () => {
  const t23 = family("t23", 2);
  const p = t23.pairs[0];
  let state = recordAnswer(emptyState(), "t23", p, false, now);
  state = recordAnswer(state, "t23", p, true, now);
  assert.equal(state.pairs[pairKey(p)].owed, true);
  state = finishRain(state, "t23", now).state;
  state = recordAnswer(state, "t23", p, true, now + DAY);
  assert.equal(state.pairs[pairKey(p)].owed, false);
});

test("due pairs are picked first, then the least met", () => {
  const t23 = family("t23", 10);
  let state = emptyState();
  state = recordAnswer(state, "t23", t23.pairs[7], false, now);
  state = finishRain(state, "t23", now).state;
  const picked = pickPairs(state, t23, now + DAY, seq(0.3, 0.7, 0.1, 0.9));
  assert.equal(picked.length, 6);
  assert.ok(picked.includes(t23.pairs[7]));
});

test("each pair is asked once per word, never twice in a row, in changing voices", () => {
  const t23 = family("t23", 6);
  const trials = makeTrials(t23.pairs, t23, Math.random);
  assert.equal(trials.length, 12);
  for (const p of t23.pairs) {
    assert.deepEqual(trials.filter((t) => t.pair === p).map((t) => t.answer).sort(), ["a", "b"]);
  }
  trials.forEach((t, i) => {
    if (i > 0) {
      assert.notEqual(t.pair, trials[i - 1].pair);
      assert.notEqual(t.voice, trials[i - 1].voice);
    }
  });
});

test("the day a mixed difference starts to sound apart is kept, once", () => {
  const t23 = family("t23", 6);
  let state = emptyState();
  for (let i = 0; i < 12; i++) state = recordAnswer(state, "t23", t23.pairs[i % 6], i % 2 === 0, now);
  let r = finishRain(state, "t23", now);
  assert.equal(r.split, false);
  assert.equal(r.state.families.t23.mixed, true);
  state = r.state;
  for (let i = 0; i < 20; i++) state = recordAnswer(state, "t23", t23.pairs[i % 6], true, now + 2 * DAY);
  r = finishRain(state, "t23", now + 2 * DAY);
  assert.equal(r.split, true);
  assert.equal(r.state.families.t23.splitAt, now + 2 * DAY);
  r = finishRain(r.state, "t23", now + 3 * DAY);
  assert.equal(r.split, false);
});

test("two records of one learner merge without losing either", async () => {
  const { mergeStates } = await import("../src/lib/rain-core.ts");
  const t23 = family("t23", 4);
  const t14 = family("t14", 4);
  // Phone: two rains of 2声と3声, one pair mixed up; it started to sound apart on day 3.
  let phone = recordAnswer(emptyState(), "t23", t23.pairs[0], false, now);
  phone = finishRain(phone, "t23", now).state;
  phone = finishRain(phone, "t23", now + 3 * DAY).state;
  phone.families.t23.splitAt = now + 3 * DAY;
  phone.voice = [10, 11];
  // Computer: one rain of 1声と4声, and the same pair met once more, told apart.
  let pc = recordAnswer(emptyState(), "t14", t14.pairs[1], true, now + DAY);
  pc = finishRain(pc, "t14", now + DAY).state;
  pc = recordAnswer(pc, "t23", t23.pairs[0], true, now + 4 * DAY);
  pc = recordAnswer(pc, "t23", t23.pairs[0], true, now + 4 * DAY);
  const m = mergeStates(phone, pc);
  assert.equal(m.rains, 2);
  assert.equal(m.families.t23.rains, 2);
  assert.equal(m.families.t23.splitAt, now + 3 * DAY);
  assert.equal(m.families.t14.rains, 1);
  assert.equal(m.pairs[pairKey(t14.pairs[1])].seen, 1);
  // The pair: met twice on the computer (more than once on the phone), so its state comes from there; misses kept.
  assert.equal(m.pairs[pairKey(t23.pairs[0])].seen, 2);
  assert.equal(m.pairs[pairKey(t23.pairs[0])].missed, 1);
  assert.deepEqual(m.voice, [10, 11]);
  // Merging is the same either way round, and merging again changes nothing.
  assert.deepEqual(mergeStates(pc, phone).families, m.families);
  assert.deepEqual(mergeStates(m, m), m);
});
