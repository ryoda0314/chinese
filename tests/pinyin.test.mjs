import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyPair, numbered, parseSyllable, surfaceTones } from "../src/lib/pinyin-core.ts";

const syl = (s) => {
  const p = parseSyllable(s);
  return p && `${p.initial}|${p.final}|${p.tone}`;
};

test("syllables come apart into initial, final and tone, spelling undone", () => {
  assert.equal(syl("mǎi"), "m|ai|3");
  assert.equal(syl("lǜ"), "l|ü|4");
  assert.equal(syl("yú"), "|ü|2");
  assert.equal(syl("wǔ"), "|u|3");
  assert.equal(syl("qù"), "q|ü|4");
  assert.equal(syl("xuě"), "x|üe|3");
  assert.equal(syl("yuán"), "|üan|2");
  assert.equal(syl("guì"), "g|uei|4");
  assert.equal(syl("liù"), "l|iou|4");
  assert.equal(syl("wèn"), "|uen|4");
  assert.equal(syl("shì"), "sh|-i|4");
  assert.equal(syl("jī"), "j|i|1");
  assert.equal(syl("ér"), "|er|2");
  assert.equal(syl("zi"), "z|-i|5");
  assert.equal(syl("yīng"), "|ing|1");
  assert.equal(syl("yǒu"), "|iou|3");
  assert.equal(parseSyllable("mǎà"), null);
  assert.equal(parseSyllable("3"), null);
});

test("numbered pinyin for ids", () => {
  assert.equal(numbered("mǎi"), "mai3");
  assert.equal(numbered("lǜ"), "lv4");
  assert.equal(numbered("zi"), "zi5");
});

test("tone sandhi: third before third, 不 and 一", () => {
  assert.deepEqual(surfaceTones("你好", [3, 3]), [2, 3]);
  assert.deepEqual(surfaceTones("展览馆", [3, 3, 3]), [2, 2, 3]);
  assert.deepEqual(surfaceTones("不是", [4, 4]), [2, 4]);
  assert.deepEqual(surfaceTones("不好", [4, 3]), [4, 3]);
  assert.deepEqual(surfaceTones("一样", [1, 4]), [2, 4]);
  assert.deepEqual(surfaceTones("一起", [1, 3]), [4, 3]);
  assert.deepEqual(surfaceTones("姐姐", [3, 5]), [3, 5]);
});

const kind = (a, pa, b, pb) => {
  const k = classifyPair({ hanzi: a, pinyin: pa }, { hanzi: b, pinyin: pb });
  return k && `${k.contrast}@${k.at.join(",")}${k.surface ? ":" + k.surface.map((s) => s.join("")).join("/") : ""}`;
};

test("tone pairs, judged by the tones as said", () => {
  assert.equal(kind("买", "mǎi", "卖", "mài"), "tone@0:3/4");
  assert.equal(kind("大学", "dà xué", "大雪", "dà xuě"), "tone@1:2/3");
  assert.equal(kind("睡觉", "shuì jiào", "水饺", "shuǐ jiǎo"), "tone@0,1:44/23");
  // 买马 and 埋马 are both said mái mǎ: not a pair.
  assert.equal(kind("买马", "mǎi mǎ", "埋马", "mái mǎ"), null);
});

test("sound pairs: exactly one sound differs, tones the same", () => {
  assert.equal(kind("肚子", "dù zi", "兔子", "tù zi"), "aspiration@0");
  assert.equal(kind("鸡", "jī", "七", "qī"), "aspiration@0");
  assert.equal(kind("四", "sì", "是", "shì"), "retroflex@0");
  assert.equal(kind("鸡", "jī", "知", "zhī"), "palatal@0");
  assert.equal(kind("小", "xiǎo", "少", "shǎo"), "palatal@0");
  assert.equal(kind("热", "rè", "乐", "lè"), "r-l@0");
  assert.equal(kind("飞", "fēi", "黑", "hēi"), "f-h@0");
  assert.equal(kind("人民", "rén mín", "人名", "rén míng"), "n-ng@1");
  assert.equal(kind("见", "jiàn", "将", "jiàng"), "n-ng@0");
  assert.equal(kind("女", "nǚ", "努", "nǔ"), "u-ü@0");
  assert.equal(kind("鱼", "yú", "无", "wú"), "u-ü@0");
  assert.equal(kind("走", "zǒu", "左", "zuǒ"), "ou-uo@0");
});

test("not minimal pairs", () => {
  assert.equal(kind("发", "fā", "花", "huā"), null); // initial and glide
  assert.equal(kind("四", "sì", "十", "shí"), null); // a sound and a tone
  assert.equal(kind("山", "shān", "三角", "sān jiǎo"), null); // lengths differ
  assert.equal(kind("酒", "jiǔ", "九", "jiǔ"), null); // the same sound
});
