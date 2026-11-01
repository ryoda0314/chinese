// 言ってみる の場面のために、アプリと同じ処理を一度だけ走らせる。学習者の声の代わりに、アプリ自身の男性の声（iapetus）の
// 大学 を「言ってみた声」として、Say.tsx がするとおりに：
//   - 高さを測り（../src/lib/pitch.ts trackPitch）、学習者の5段に置いて線にし（learner.ts・tone.ts）、
//   - 線が 大学 と 大雪 のどちらに近いかを決め（learner.ts nearer：手本の声すべてと比べた中央値）、
//   - 何に聞こえたかを /api/hear と同じ頼み方で音声認識に聞く（gpt-4o-transcribe、language zh、
//     「以下是一个普通话词语。」。どの語かは伝えない）。
// 書いたもの（src/say.json）を、映像はそのまま描く。線も判定も聞こえた語も、ここで作り足していない。
//   node scripts/say.mjs --env ../.env.local        (npm run say)
// 鍵：.env の OPENAI_API_KEY（ことのおと と同じ）。鍵の値はどこにも出さない。
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { centerEstimate, learnerCenter, learnerLevels, learnerPitchRange, nearer, nearestVoice, remember, spanOf } from "../../src/lib/learner.ts";
import { trackPitch } from "../../src/lib/pitch.ts";
import { lineOf } from "../../src/lib/tone.ts";

const STAND_IN = "iapetus";
const WORD = "da4xue2-858b";
const PARTNER = "da4xue3-7c72";
const FPS = 30;

const args = process.argv.slice(2);
const envPath = args[args.indexOf("--env") + 1];
if (!envPath || !existsSync(envPath)) throw new Error("--env <.env のパス> が要る（OPENAI_API_KEY）");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, "")]),
);
if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY が無い");

const app = JSON.parse(readFileSync("src/app.json", "utf8"));
const word = app.rain.words[WORD];
const partner = app.rain.words[PARTNER];

// 録音の代わり：アプリの声を、アプリが音声認識に送るのと同じ 16 kHz・16bit・モノの WAV に。
mkdirSync("node_modules/.cache", { recursive: true });
const wavFile = "node_modules/.cache/say.wav";
const r = spawnSync(
  "npx",
  ["remotion", "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", `../public/audio/${STAND_IN}/${WORD}.mp3`, "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wavFile],
  { encoding: "utf8", shell: true },
);
if (r.status !== 0) throw new Error(r.stderr);
const wav = readFileSync(wavFile);
const pcm = new Int16Array(wav.buffer.slice(wav.byteOffset + 44, wav.byteOffset + wav.length));
const samples = Float32Array.from(pcm, (x) => x / 32768);

// Say.tsx の say() と同じ順に（はじめて言ってみる人：これまでの見積もりは無い）。
const frames = trackPitch(samples, 16000, learnerPitchRange([]));
const span = spanOf(app.voices);
const estimate = centerEstimate(frames, word, span);
const estimates = remember([], estimate);
const mid = learnerCenter(estimates);
if (mid === null) throw new Error("声が拾えなかった");
const line = lineOf(frames, learnerLevels(mid, span));
const verdict = nearer(line, word, partner);
const voice = nearestVoice(app.voices, mid, Object.keys(word.lines));
// 手本：はじめての人には、声の一覧の最初の声から（hearModel：nearestVoice(voices, null, …)）。
const model = nearestVoice(app.voices, null, Object.keys(word.lines));

// 声の大きさ（録音中の輪の濃さ：Say.tsx の --level）。コマごとの RMS を 0〜1 に。
const per = Math.floor(16000 / FPS);
const levels = [];
for (let i = 0; i + per <= samples.length; i += per) {
  let s = 0;
  for (let k = i; k < i + per; k++) s += samples[k] * samples[k];
  levels.push(Math.min(1, Math.sqrt(s / per) * 6));
}

// /api/hear と同じ頼み方で。
const form = new FormData();
form.append("file", new Blob([wav], { type: "audio/wav" }), "attempt.wav");
form.append("model", "gpt-4o-transcribe");
form.append("language", "zh");
form.append("prompt", "以下是一个普通话词语。");
const res = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` }, body: form });
if (!res.ok) throw new Error(`音声認識 HTTP ${res.status}`);
const text = (await res.json()).text.replace(/[^\p{Script=Han}]/gu, "");
// アプリと同じく、語か組の相手なら、その語の確かめたピンインで。
const known = [word, partner].find((w) => w.hanzi === text);

const out = {
  note: "学習者の声の代わりに、アプリ自身の声（standIn）。線・判定・聞こえた語は、アプリと同じ処理で出したもの（scripts/say.mjs）。",
  standIn: STAND_IN,
  word: WORD,
  partner: PARTNER,
  model,
  voice,
  line,
  nearer: verdict.nearer === "a" ? "word" : verdict.nearer === "b" ? "partner" : null,
  distance: { word: Math.round(verdict.a * 1000) / 1000, partner: Math.round(verdict.b * 1000) / 1000 },
  heard: { text, pinyin: known?.pinyin ?? "" },
  levels,
};
writeFileSync("src/say.json", `${JSON.stringify(out, null, 1)}\n`);
console.log(`  線は ${out.nearer === "word" ? word.hanzi : out.nearer === "partner" ? partner.hanzi : "どちらとも言えない"} に近い（${out.distance.word} / ${out.distance.partner}）、手本の声 ${voice}、聞こえた語「${text}」`);
