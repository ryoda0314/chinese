// Builds what the app fetches, from the checked data: public/data/index.json (voices, differences) and one file per
// difference, public/data/f/<id>.json (its pairs, their words with each voice's pitch line, and ことのあめ sentences).
// A pair is in only when both its words have checked clips in at least MIN_VOICES voices.
//   node scripts/build-data.mjs
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const MIN_VOICES = 2;

const words = new Map(JSON.parse(readFileSync("data/words.json", "utf8")).map((w) => [w.id, w]));
const families = JSON.parse(readFileSync("data/families.json", "utf8"));
const clips = JSON.parse(readFileSync("data/clips.json", "utf8"));
const sentences = existsSync("data/sentences.json") ? JSON.parse(readFileSync("data/sentences.json", "utf8")) : {};

function linesOf(id) {
  const lines = {};
  for (const v of clips.voices) {
    const c = clips.clips[`${v.id}/${id}`];
    if (c?.status === "pass" && existsSync(`public/audio/${v.id}/${id}.mp3`)) lines[v.id] = c.line;
  }
  return lines;
}

/** For a word whose vowel is u or ü itself: each voice's measured frontness (src/lib/vowel.ts), else null. */
function frontsOf(id, lines) {
  const out = {};
  for (const v of Object.keys(lines)) {
    const f = clips.clips[`${v}/${id}`]?.front;
    if (typeof f === "number") out[v] = +f.toFixed(1);
  }
  return Object.keys(out).length ? out : null;
}

rmSync("public/data/f", { recursive: true, force: true });
mkdirSync("public/data/f", { recursive: true });
const index = { version: "", voices: clips.voices.map(({ id, sex, lo, hi }) => ({ id, sex, lo, hi })), families: [] };
let pairCount = 0;
for (const f of families) {
  const out = { id: f.id, pairs: [], words: {}, sentences: {} };
  for (const p of f.pairs) {
    const la = linesOf(p.a);
    const lb = linesOf(p.b);
    if (Object.keys(la).length < MIN_VOICES || Object.keys(lb).length < MIN_VOICES) continue;
    out.pairs.push(p);
    for (const [id, lines] of [[p.a, la], [p.b, lb]]) {
      const { hanzi, pinyin, ja } = words.get(id);
      const front = f.id === "uv" ? frontsOf(id, lines) : null;
      out.words[id] = { id, hanzi, pinyin, ja, lines, ...(front ? { front } : {}) };
      if (sentences[id]) out.sentences[id] = sentences[id].map(({ zh, pinyin, ja, audio, at }) => ({ zh, pinyin, ja, audio, at }));
    }
  }
  if (!out.pairs.length) continue;
  writeFileSync(`public/data/f/${f.id}.json`, JSON.stringify(out));
  index.families.push({ id: f.id, pairs: out.pairs.length });
  pairCount += out.pairs.length;
}
// Readings for the hearing endpoint: ことのあめ's fixes for words pinyin-pro misreads, and this app's own words of two
// or more characters (包子 bāo zi, not zǐ). Single characters are left alone: forcing one reading on them would be
// wrong in other words.
const readings = JSON.parse(readFileSync("src/lib/pinyin-words.json", "utf8"));
for (const w of words.values()) if ([...w.hanzi].length > 1) readings[w.hanzi] = w.pinyin;
writeFileSync("src/lib/readings.json", JSON.stringify(readings, null, 1) + "\n");

// A version from the contents, so a new build is fetched past any cache.
index.version = createHash("sha1").update(JSON.stringify(index)).digest("hex").slice(0, 10);
writeFileSync("public/data/index.json", JSON.stringify(index));
console.log(`${index.families.length} differences, ${pairCount} pairs: ${index.families.map((f) => `${f.id} ${f.pairs}`).join(", ")}`);
