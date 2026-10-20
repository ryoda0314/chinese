// Borrows ことのあめ's Chinese example sentences for the 文の中で step: for each word in data/words.json, a few short
// approved sentences in which the word appears with the same reading (by the library's checked pinyin), with their
// Japanese and the URL of the clip ことのあめ already stores. Reads only; writes data/sentences.json.
// Run with ことのあめ's keys:
//   node --env-file=../../polylinga/.env.local scripts/export-sentences.mjs
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const PER_WORD = 3;
const MAX_HAN = 16;
const AUDIO = (zh) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/pl-audio/Kore/zh/${createHash("sha256").update(zh, "utf8").digest("hex")}.wav`;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const rows = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase
    .from("pl_sentences")
    .select("key, zh, ja, zh_pinyin")
    .eq("status", "approved")
    .not("zh_pinyin", "is", null)
    .order("key")
    .range(from, from + 999);
  if (error) throw new Error(error.message);
  rows.push(...data);
  if (data.length < 1000) break;
}
console.log(`${rows.length} approved sentences with checked pinyin`);

const HAN = /\p{Script=Han}/u;

// Each sentence's Han characters with their syllables.
const sentences = rows.flatMap((r) => {
  const chars = [...r.zh];
  const syllables = r.zh_pinyin.trim().split(/\s+/);
  const han = chars.filter((c) => HAN.test(c));
  if (han.length !== syllables.length || han.length > MAX_HAN) return [];
  return [{ ...r, han: han.join(""), syllables }];
});

const words = JSON.parse(readFileSync("data/words.json", "utf8"));
const out = {};
let found = 0;
for (const w of words) {
  const target = w.pinyin.split(" ");
  const hits = [];
  for (const s of sentences) {
    for (let i = s.han.indexOf(w.hanzi); i >= 0; i = s.han.indexOf(w.hanzi, i + 1)) {
      const said = s.syllables.slice(i, i + target.length);
      // The same reading, tones and all: 是 inside 还是 (hái shi, neutral) is not the shì being learned.
      const same = said.every((x, k) => x === target[k]);
      if (same) {
        hits.push({ key: s.key, zh: s.zh, pinyin: s.zh_pinyin, ja: s.ja, at: i });
        break;
      }
    }
  }
  if (!hits.length) continue;
  hits.sort((a, b) => [...a.zh].length - [...b.zh].length);
  out[w.id] = hits.slice(0, PER_WORD).map((h) => ({ ...h, audio: AUDIO(h.zh) }));
  found++;
}

// Keep only sentences whose clip is really there.
let missing = 0;
for (const [id, list] of Object.entries(out)) {
  const kept = [];
  for (const s of list) {
    const head = await fetch(s.audio, { method: "HEAD" }).catch(() => null);
    if (head?.ok) kept.push(s);
    else missing++;
  }
  if (kept.length) out[id] = kept;
  else delete out[id];
}
writeFileSync("data/sentences.json", JSON.stringify(out, null, 1) + "\n");
console.log(`${Object.keys(out).length} of ${words.length} words have sentences (${found} before checking clips; ${missing} clips missing)`);
