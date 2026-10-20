// Before generating everything: can Gemini TTS say one word on its own with the right tones, without reading the
// instruction aloud, and can a recognizer tell what it said? A few words, a few voices, three ways of asking.
//   node --env-file=.env.local scripts/probe-tts.mjs [--voices=Kore,Charon] [--asr]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pinyin } from "pinyin-pro";
import { parsePinyin } from "../src/lib/pinyin-core.ts";
import { rangeForVoice, trackPitch, voicedPoints } from "../src/lib/pitch.ts";
import { judgeTones, lineOf, rangeFromTones } from "../src/lib/tone.ts";
import { synthesize, transcribe, withRetry } from "./lib/services.mjs";
import { readWav, tidy } from "./lib/wav.mjs";

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const VOICES = (arg("voices") ?? "Kore,Charon").split(",");
const PROMPTS = {
  en: (w) => `Say this Mandarin Chinese word once, clearly and naturally, in standard Putonghua:\n${w}`,
  zh: (w) => `用标准普通话，清楚自然地读一遍这个词：\n${w}`,
  bare: (w) => w,
};
const WORDS = [
  ["汤", "tāng"], ["糖", "táng"], ["躺", "tǎng"], ["烫", "tàng"],
  ["买", "mǎi"], ["卖", "mài"], ["大学", "dà xué"], ["大雪", "dà xuě"],
];
const ASR_MODELS = ["gpt-transcribe", "gpt-4o-transcribe", "gpt-4o-mini-transcribe", "whisper-1"];
const DIR = "scripts/work/probe";

const jobs = [];
for (const p of Object.keys(PROMPTS)) for (const v of VOICES) for (const [h, py] of WORDS) jobs.push({ p, v, h, py });

let next = 0;
async function worker() {
  while (next < jobs.length) {
    const j = jobs[next++];
    const dir = `${DIR}/${j.p}/${j.v}`;
    const file = `${dir}/${j.h}.wav`;
    if (existsSync(file)) continue;
    mkdirSync(dir, { recursive: true });
    const wav = await withRetry(() => synthesize(PROMPTS[j.p](j.h), j.v));
    writeFileSync(file, wav);
    process.stdout.write(".");
  }
}
await Promise.all([worker(), worker()]);
console.log("\ngenerated");

// Analyse: per prompt and voice, the voice's range from these clips, then each clip's line against its tones.
const rows = [];
for (const p of Object.keys(PROMPTS)) {
  for (const v of VOICES) {
    const clips = WORDS.map(([h, py]) => {
      const raw = readFileSync(`${DIR}/${p}/${v}/${h}.wav`);
      const { rate, samples } = readWav(raw);
      const clean = tidy(samples, rate);
      const frames = trackPitch(clean, rate);
      return { h, py, raw, rate, clean, rawSeconds: samples.length / rate, seconds: clean.length / rate, frames };
    });
    // Second pass within the voice's own range.
    const voiceRange = rangeForVoice(clips.flatMap((c) => c.frames.flatMap((f) => (f.hz ? [f.hz] : []))));
    for (const c of clips) c.frames = trackPitch(c.clean, c.rate, voiceRange);
    const range = rangeFromTones(
      clips.map((c) => ({ tones: parsePinyin(c.py).map((s) => s.tone), semitones: voicedPoints(c.frames).map(([, st]) => st) })),
    );
    for (const c of clips) {
      const tones = parsePinyin(c.py).map((s) => s.tone);
      const line = lineOf(c.frames, range);
      const j = judgeTones(line, tones);
      rows.push({
        p, v, h: c.h, py: c.py,
        raw: c.rawSeconds.toFixed(2), s: c.seconds.toFixed(2),
        range: `${range.lo.toFixed(1)}..${range.hi.toFixed(1)}`,
        fit: j.target.toFixed(2), rival: `${j.rival.tones.join("")}:${j.rival.distance.toFixed(2)}`,
        ok: j.target < j.rival.distance ? "✓" : "✗",
        line: line.map((x) => (x === null ? "." : Math.round(x))).join(""),
        file: `${DIR}/${p}/${v}/${c.h}.wav`,
      });
    }
  }
}
for (const r of rows) console.log([r.p.padEnd(4), r.v.padEnd(7), r.h, r.py.padEnd(8), r.raw, r.s, r.range, r.fit, r.rival, r.ok, r.line].join("  "));

if (process.argv.includes("--asr")) {
  console.log("\nASR (prompt says only: one Mandarin word)");
  for (const r of rows) {
    const heard = [];
    for (const m of ASR_MODELS) {
      try {
        const text = await withRetry(() => transcribe(readFileSync(r.file), m));
        heard.push(`${text}(${pinyin(text, { toneType: "symbol" })})`);
      } catch (err) {
        heard.push(`ERR ${String(err.message).slice(0, 60)}`);
      }
    }
    console.log([r.p.padEnd(4), r.v.padEnd(7), r.h, r.py.padEnd(8), ...heard].join("  "));
  }
}
