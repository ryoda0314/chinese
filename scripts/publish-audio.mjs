// Encodes every clip that passed its checks (data/clips.json, from scripts/generate-audio.mjs) for the app:
// public/audio/<voice>/<word id>.mp3, trimmed and levelled exactly as it was checked. Clips that no longer pass are
// removed. Reads data/ only, so it can run while a generation is still going.
//   node scripts/publish-audio.mjs
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { Mp3Encoder } from "@breezystack/lamejs";
import { readWav, tidy } from "./lib/wav.mjs";

const KBPS = 48;
const RAW = "scripts/work/raw";
const { voices, clips } = JSON.parse(readFileSync("data/clips.json", "utf8"));

let written = 0;
let removed = 0;
for (const voice of voices) {
  const dir = `public/audio/${voice.id}`;
  mkdirSync(dir, { recursive: true });
  const keep = new Set();
  for (const [key, c] of Object.entries(clips)) {
    const [v, id] = key.split("/");
    if (v !== voice.id || c.status !== "pass") continue;
    const raw = `${RAW}/${v}/${id}.${c.attempt}.wav`;
    if (!existsSync(raw)) continue;
    const { rate, samples } = readWav(readFileSync(raw));
    const clean = tidy(samples, rate);
    const pcm = new Int16Array(clean.length);
    for (let i = 0; i < clean.length; i++) pcm[i] = Math.round(Math.max(-1, Math.min(1, clean[i])) * 32767);
    const enc = new Mp3Encoder(1, rate, KBPS);
    writeFileSync(`${dir}/${id}.mp3`, Buffer.concat([Buffer.from(enc.encodeBuffer(pcm)), Buffer.from(enc.flush())]));
    keep.add(`${id}.mp3`);
    written++;
  }
  for (const f of readdirSync(dir)) {
    if (!keep.has(f)) {
      rmSync(`${dir}/${f}`);
      removed++;
    }
  }
}
console.log(`wrote ${written} clips, removed ${removed}`);
