import assert from "node:assert/strict";
import { test } from "node:test";
import { addPair, checkNewPair, meaningOf, parsePairs, removePair, setMeaning } from "../src/lib/pairs-file.ts";

const FILE = `# comment
## t14
汤 tāng スープ | 烫 tàng 熱い
八 bā 八 | 爸 bà お父さん

## t12
汤 tāng | 糖 táng 砂糖
八 bā | 拔 bá 抜く
`;

test("pairs are read with their difference", () => {
  const { families, pairs } = parsePairs(FILE);
  assert.deepEqual(families, ["t14", "t12"]);
  assert.equal(pairs.length, 4);
  assert.deepEqual(pairs[2].a, { hanzi: "汤", pinyin: "tāng", ja: "" });
  assert.equal(meaningOf(FILE, { hanzi: "汤", pinyin: "tāng" }), "スープ");
});

test("a removed pair is commented out, and its meanings move to the words' next lines", () => {
  const out = removePair(FILE, { hanzi: "汤", pinyin: "tāng" }, { hanzi: "烫", pinyin: "tàng" });
  assert.match(out, /^#外した 汤 tāng スープ \| 烫 tàng 熱い$/m);
  assert.match(out, /^汤 tāng スープ \| 糖 táng 砂糖$/m);
  assert.equal(parsePairs(out).pairs.length, 3);
  assert.equal(meaningOf(out, { hanzi: "汤", pinyin: "tāng" }), "スープ");
});

test("a meaning is changed wherever it is written", () => {
  const out = setMeaning(FILE, { hanzi: "八", pinyin: "bā" }, "はち");
  assert.match(out, /^八 bā はち \| 爸 bà お父さん$/m);
  assert.match(out, /^八 bā \| 拔 bá 抜く$/m);
});

test("a new pair goes at the end of its difference, with meanings only for new words", () => {
  const out = addPair(FILE, "t14", { hanzi: "妈", pinyin: "mā", ja: "お母さん" }, { hanzi: "骂", pinyin: "mà", ja: "叱る" });
  const lines = out.split("\n");
  assert.equal(lines[4], "妈 mā お母さん | 骂 mà 叱る");
  assert.equal(lines[5], "");
  // A known word goes in without its meaning again.
  const out2 = addPair(FILE, "t13", { hanzi: "汤", pinyin: "tāng", ja: "" }, { hanzi: "躺", pinyin: "tǎng", ja: "横になる" });
  assert.ok(out2.endsWith("\n## t13\n汤 tāng | 躺 tǎng 横になる\n"), out2);
});

test("a new pair is refused when it is not a pair of that difference, or clashes with the file", () => {
  const w = (hanzi, pinyin, ja = "x") => ({ hanzi, pinyin, ja });
  assert.match(checkNewPair(FILE, "t23", w("买", "mǎi"), w("卖", "mài")), /t34 の違い/);
  assert.match(checkNewPair(FILE, "t14", w("发", "fā"), w("花", "huā")), /1か所だけ違う組/);
  assert.match(checkNewPair(FILE, "t14", w("汤", "tāng", ""), w("烫", "tàng", "")), /もうあります/);
  assert.match(checkNewPair(FILE, "t14", w("鸡", "jī", ""), w("记", "jì")), /意味を書いて/);
  assert.match(checkNewPair(FILE, "t14", w("汤", "tāng", "ゆ"), w("趟", "tàng")), /「スープ」/);
  assert.match(checkNewPair(FILE, "t14", w("汤", "táng"), w("烫", "tàng")), /ほかの組で tāng/);
  assert.equal(checkNewPair(FILE, "t14", w("鸡", "jī", "鶏"), w("记", "jì", "覚える")), null);
});
