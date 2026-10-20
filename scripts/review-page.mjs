g // A page for a person to listen to the clips the machine could not pass (data/review.json): each take, trimmed as the
// app would play it, with what the recognizer heard and why it failed, next to the same word in the other voices.
// Open http://localhost:3000/review/index.html with `npm run dev` running. A take that sounds right goes into
// data/approved.json ("voice/id.take"); scripts/generate-audio.mjs --no-generate then counts it as passing.
//   node scripts/review-page.mjs
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { floatToWav, readWav, tidy } from "./lib/wav.mjs";

const review = JSON.parse(readFileSync("data/review.json", "utf8"));
const { voices, clips } = JSON.parse(readFileSync("data/clips.json", "utf8"));
const asr = existsSync("data/asr.json") ? JSON.parse(readFileSync("data/asr.json", "utf8")) : {};
const RAW = "scripts/work/raw";
const OUT = "public/review";

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const copy = (voice, id, take) => {
  const src = `${RAW}/${voice}/${id}.${take}.wav`;
  if (!existsSync(src)) return null;
  const { rate, samples } = readWav(readFileSync(src));
  const name = `${voice}-${id}-${take}.wav`;
  writeFileSync(`${OUT}/${name}`, floatToWav(tidy(samples, rate), rate));
  return name;
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const rows = review.map((r) => {
  const takes = [0, 1, 2, 3, 4]
    .map((t) => ({ t, file: copy(r.voice, r.id, t), heard: asr[`${r.voice}/${r.id}.${t}`] }))
    .filter((x) => x.file);
  const others = voices
    .filter((v) => v.id !== r.voice && clips[`${v.id}/${r.id}`]?.status === "pass")
    .map((v) => ({ v: v.id, file: copy(v.id, r.id, clips[`${v.id}/${r.id}`].attempt) }));
  return `<section>
  <h2><span lang="zh-CN">${esc(r.hanzi)}</span> ${esc(r.pinyin)} <small>${esc(r.voice)}</small></h2>
  <p class="why">${esc(r.why)}</p>
  ${takes
    .map(
      (x) => `<div class="take"><code>${esc(`${r.voice}/${r.id}.${x.t}`)}</code> <audio controls src="${x.file}"></audio>
    <span class="heard">${esc(Object.entries(x.heard ?? {}).map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`).join(" · "))}</span></div>`,
    )
    .join("\n  ")}
  <p class="others">ほかの声：${others.map((o) => `${esc(o.v)} <audio controls src="${o.file}"></audio>`).join(" ")}</p>
</section>`;
});

writeFileSync(
  `${OUT}/index.html`,
  `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>聞いて決める</title><style>
body { margin: 0 auto; max-width: 860px; padding: 24px 16px 64px; font-family: system-ui, sans-serif; background: #fcfbf8; color: #172033; }
section { padding: 16px 0; border-bottom: 1px solid #e4e7ec; } h2 { margin: 0 0 4px; font-size: 22px; } small { color: #5c6578; font-size: 13px; }
.why, .heard, .others { color: #5c6578; font-size: 13px; } .take { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 6px 0; }
audio { height: 32px; vertical-align: middle; } code { font-size: 12px; }
</style></head><body>
<h1>聞いて決める（${review.length}）</h1>
<p>機械が通せなかった音声です。正しく聞こえる take の <code>voice/id.take</code> を <code>data/approved.json</code> の配列に書き足し、
<code>node --env-file=.env.local scripts/generate-audio.mjs --no-generate</code> を流すと合格になります。</p>
${rows.join("\n")}
</body></html>
`,
);
console.log(`${review.length} clips to listen to: ${OUT}/index.html`);
