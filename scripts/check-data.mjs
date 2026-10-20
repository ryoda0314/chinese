// Checks data/pairs.txt and compiles it into data/words.json and data/families.json, which the audio generator and
// the app read. Every pair must really be the kind of pair its family says (tones compared as said, after sandhi),
// every word's pinyin must agree with pinyin-pro (or be listed in AGREED below after a person checked it), and a word
// must mean the same wherever it appears.
//   node scripts/check-data.mjs            # check and write
//   node scripts/check-data.mjs --dry-run  # check only
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pinyin, polyphonic } from "pinyin-pro";
import { classifyPair, numbered, parsePinyin } from "../src/lib/pinyin-core.ts";

// Readings that differ from pinyin-pro's and were checked by hand.
const AGREED = new Set(["包子|bāo zi", "肚子|dù zi"]);

const FAMILY_OF = {
  aspiration: "asp", retroflex: "retro", palatal: "pal", "n-ng": "nng", "u-ü": "uv", "r-l": "rl", "f-h": "fh", "ou-uo": "ouuo",
};
function familyOf(kind) {
  if (kind.contrast !== "tone") return FAMILY_OF[kind.contrast];
  if (kind.at.length > 1) return "tw";
  const pair = [kind.surface[0][0], kind.surface[1][0]].sort();
  return pair.includes(5) ? "t5" : `t${pair[0]}${pair[1]}`;
}

/** Stable ids: the pinyin with tone numbers, and four hex digits of the characters, so homophones never collide. */
function wordId(hanzi, py) {
  const hash = createHash("sha1").update(hanzi, "utf8").digest("hex").slice(0, 4);
  return `${py.split(" ").map(numbered).join("")}-${hash}`;
}

const errors = [];
const warnings = [];
const words = new Map(); // "hanzi|pinyin" → word
const families = new Map(); // id → { id, pairs: [] }
const seenPairs = new Set();

function word(side, line) {
  const tokens = side.trim().split(/\s+/);
  const hanzi = tokens[0];
  const n = [...hanzi].length;
  const py = tokens.slice(1, 1 + n).join(" ").normalize("NFC");
  const ja = tokens.slice(1 + n).join(" ");
  if (!parsePinyin(py) || parsePinyin(py).length !== n) {
    errors.push(`line ${line}: "${side.trim()}" needs one syllable per character`);
    return null;
  }
  const key = `${hanzi}|${py}`;
  const known = words.get(key);
  if (known) {
    if (ja && ja !== known.ja) errors.push(`line ${line}: ${hanzi} means "${known.ja}" earlier, "${ja}" here`);
    return known;
  }
  if (!ja) {
    errors.push(`line ${line}: ${hanzi} ${py} has no meaning (its first appearance)`);
    return null;
  }
  for (const other of words.values()) {
    if (other.hanzi === hanzi) errors.push(`line ${line}: ${hanzi} is read ${other.pinyin} elsewhere and ${py} here`);
  }
  const w = { id: wordId(hanzi, py), hanzi, pinyin: py, ja };
  words.set(key, w);

  const dict = pinyin(hanzi, { toneType: "symbol", type: "array" }).join(" ").normalize("NFC");
  if (dict !== py && !AGREED.has(key)) warnings.push(`line ${line}: ${hanzi} ${py} — pinyin-pro reads ${dict}`);
  if (n === 1) {
    const readings = polyphonic(hanzi, { toneType: "symbol", type: "array" })[0] ?? [];
    if (readings.length > 1) warnings.push(`line ${line}: ${hanzi} alone has readings ${readings.join(" / ")} (the generated clip is checked)`);
  }
  return w;
}

let family = null;
readFileSync("data/pairs.txt", "utf8")
  .split(/\r?\n/)
  .forEach((raw, i) => {
    const line = i + 1;
    const text = raw.trim();
    if (!text) return;
    const header = text.match(/^##\s+(\S+)/);
    if (header) {
      family = header[1];
      if (!families.has(family)) families.set(family, { id: family, pairs: [] });
      return;
    }
    if (text.startsWith("#")) return;
    if (!family) return errors.push(`line ${line}: a pair before any "## family" line`);
    const sides = text.split("|");
    if (sides.length !== 2) return errors.push(`line ${line}: expected "word | word"`);
    const a = word(sides[0], line);
    const b = word(sides[1], line);
    if (!a || !b) return;
    const kind = classifyPair(a, b);
    if (!kind) return errors.push(`line ${line}: ${a.hanzi} ${a.pinyin} / ${b.hanzi} ${b.pinyin} is not a minimal pair`);
    const actual = familyOf(kind);
    if (actual !== family) return errors.push(`line ${line}: ${a.hanzi}/${b.hanzi} is a ${actual} pair, listed under ${family}`);
    const pairKey = [a.id, b.id].sort().join("+");
    if (seenPairs.has(pairKey)) return errors.push(`line ${line}: ${a.hanzi}/${b.hanzi} is listed twice`);
    seenPairs.add(pairKey);
    families.get(family).pairs.push({ a: a.id, b: b.id, at: kind.at });
  });

for (const w of warnings) console.log(`warning ${w}`);
for (const e of errors) console.log(`ERROR   ${e}`);
const counts = [...families.values()].map((f) => `${f.id} ${f.pairs.length}`).join(", ");
console.log(`\n${words.size} words, ${seenPairs.size} pairs (${counts}); ${errors.length} errors, ${warnings.length} warnings`);
if (errors.length) process.exit(1);

if (!process.argv.includes("--dry-run")) {
  const list = [...words.values()].sort((p, q) => p.id.localeCompare(q.id));
  writeFileSync("data/words.json", JSON.stringify(list, null, 1) + "\n");
  writeFileSync("data/families.json", JSON.stringify([...families.values()], null, 1) + "\n");
  console.log("wrote data/words.json, data/families.json");
}
