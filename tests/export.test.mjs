import assert from "node:assert/strict";
import { test } from "node:test";
import { buildExport } from "../src/lib/export.ts";
import { logRain, logSaid, setHeard } from "../src/lib/log-core.ts";
import { emptyState, finishRain, pairKey, recordAnswer } from "../src/lib/rain-core.ts";

const words = {
  xue2: { id: "xue2", hanzi: "大学", pinyin: "dà xué", ja: "大学", lines: {} },
  xue3: { id: "xue3", hanzi: "大雪", pinyin: "dà xuě", ja: "大雪", lines: {} },
  mai3: { id: "mai3", hanzi: "买", pinyin: "mǎi", ja: "買う", lines: {} },
  mai4: { id: "mai4", hanzi: "卖", pinyin: "mài", ja: "売る", lines: {} },
};
const t23 = { id: "t23", pairs: [{ a: "xue2", b: "xue3", at: [1] }, { a: "mai3", b: "mai4", at: [0] }], words, sentences: {} };
const now = new Date("2026-10-20T03:00:00Z").getTime();

test("the record reads as one text: a request first, then what was done", () => {
  let s = recordAnswer(emptyState(), "t23", t23.pairs[0], false, now);
  s = recordAnswer(s, "t23", t23.pairs[1], true, now);
  s = finishRain(s, "t23", now).state;
  s = { ...s, log: logRain(s.log, { at: now, family: "t23", pairs: t23.pairs.map(pairKey), missed: [pairKey(t23.pairs[0])] }) };
  s = { ...s, log: logSaid(s.log, { at: now + 1, word: "xue2", partner: "xue3", family: "t23", line: [3, 4], nearer: "partner" }) };
  s = { ...s, log: setHeard(s.log, now + 1, "大雪") };
  const text = buildExport(s, new Map([["t23", t23]]), now);
  assert.match(text, /^# ことのね 学習の記録（10月20日）/);
  assert.match(text, /教えてください。/);
  assert.match(text, /浴びた雨: 1回/);
  assert.match(text, /### 2声と3声（雨 1回）/);
  assert.match(text, /いまも取り違えている組: 大学 dà xué ／ 大雪 dà xuě（会った 1回・取り違えた 1回）/);
  assert.match(text, /取り違えていない組: 1組（会った組 2 \/ 2）/);
  assert.match(text, /大学 dà xué（組の相手: 大雪 dà xuě）: 1回。最近は声調の線は「大雪」に近い。音声認識に聞こえた語: 大雪/);
  assert.match(text, /10月20日: 雨: 2声と3声 \/ 取り違えた組: 大学 dà xué ／ 大雪 dà xuě \/ 言ってみた: 大学/);
});

test("an empty record still makes sense", () => {
  const text = buildExport(emptyState(), new Map(), now);
  assert.match(text, /浴びた雨: 0回/);
  assert.match(text, /出会った違い: 0（なし）/);
});
