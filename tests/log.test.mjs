import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dayOf,
  daysOf,
  forgetSaid,
  logRain,
  logSaid,
  mergeLogs,
  RAINS_KEPT,
  SAID_KEPT,
  SAID_PER_WORD,
  saidByWord,
  setHeard,
} from "../src/lib/log-core.ts";

const t = (iso) => new Date(iso).getTime();
const rain = (at, family, missed = []) => ({ at, family, pairs: ["a+b", "c+d"], missed });
const said = (at, word, line = [3, 3.14159, null]) => ({ at, word, partner: "p", family: "t23", line, nearer: "word" });

test("days are the learner's days in Japan", () => {
  assert.equal(dayOf(t("2026-10-19T14:59:00Z")), "2026-10-19");
  assert.equal(dayOf(t("2026-10-19T15:00:00Z")), "2026-10-20");
});

test("a day gathers its rains by difference, the pairs mixed up, and the words said", () => {
  let log = logRain(undefined, rain(t("2026-10-19T01:00:00Z"), "t23", ["a+b"]));
  log = logRain(log, rain(t("2026-10-19T02:00:00Z"), "t14"));
  log = logRain(log, rain(t("2026-10-19T03:00:00Z"), "t23", ["c+d", "a+b"]));
  log = logSaid(log, said(t("2026-10-19T03:05:00Z"), "w1"));
  log = logSaid(log, said(t("2026-10-19T03:06:00Z"), "w1"));
  log = logRain(log, rain(t("2026-10-20T01:00:00Z"), "asp"));
  const days = daysOf(log);
  assert.deepEqual(days.map((d) => d.day), ["2026-10-20", "2026-10-19"]);
  assert.deepEqual(days[1].rains, [
    { family: "t23", times: 2, missed: ["a+b", "c+d"] },
    { family: "t14", times: 1, missed: [] },
  ]);
  assert.deepEqual(days[1].said, ["w1"]);
});

test("lines are kept small, and what was heard joins its attempt later", () => {
  let log = logSaid(undefined, said(100, "w1"));
  assert.deepEqual(log.said[0].line, [3, 3.1, null]);
  log = setHeard(log, 100, "大学");
  assert.equal(log.said[0].heard, "大学");
});

test("a word keeps its first line and its latest ones", () => {
  let log;
  for (let i = 0; i < SAID_PER_WORD + 4; i++) log = logSaid(log, said(1000 + i, "w1"));
  const kept = saidByWord(log)[0].attempts.map((a) => a.at);
  assert.equal(kept.length, SAID_PER_WORD);
  assert.equal(kept[0], 1000);
  assert.equal(kept.at(-1), 1000 + SAID_PER_WORD + 3);
});

test("the log is bounded: the newest rains, and lines over the limit go oldest first but firsts last", () => {
  let log;
  for (let i = 0; i < RAINS_KEPT + 10; i++) log = logRain(log, rain(i, "t23"));
  assert.equal(log.rains.length, RAINS_KEPT);
  assert.equal(log.rains[0].at, 10);
  for (let i = 0; i < SAID_KEPT + 20; i++) log = logSaid(log, said(10_000 + i, `w${i}`));
  assert.equal(log.said.length, SAID_KEPT);
});

test("two logs merge with each entry once, either way round", () => {
  const phone = logSaid(logRain(undefined, rain(1, "t23", ["a+b"])), said(2, "w1"));
  const pc = logRain(logRain(undefined, rain(1, "t23", ["a+b"])), rain(3, "asp"));
  const m = mergeLogs(phone, pc);
  assert.deepEqual(m.rains.map((r) => r.at), [1, 3]);
  assert.deepEqual(m.said.map((s) => s.at), [2]);
  assert.deepEqual(mergeLogs(pc, phone), m);
  assert.deepEqual(mergeLogs(m, m), m);
});

test("lines can be let go, one word or all", () => {
  let log = logSaid(logSaid(undefined, said(1, "w1")), said(2, "w2"));
  assert.deepEqual(forgetSaid(log, "w1").said.map((s) => s.word), ["w2"]);
  assert.deepEqual(forgetSaid(log).said, []);
});
