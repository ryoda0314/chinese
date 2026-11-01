// 映像に要るものを public/ と src/ に集める。どれもアプリそのものから取る（作り直さない）。
//   - アプリのアイコン（../public/icons/icon-512.png）
//   - アプリの中国語の声（../public/audio/<voice>/<id>.mp3）：映像で鳴らす語と声だけ。名前はアプリと同じ <voice>/<id>
//   - ことのあめ の例文の声（../public/data/f/t23.json の sentences の audio：ことのあめ の公開の置き場から）
//     声はどれもナレーションの近くの大きさ（声のある所の RMS でおよそ -17 dBFS、ピークは -1 dBFS まで）にそろえて WAV に
//   - src/app.json：映像に出すアプリの言葉（../src/lib/i18n/ja.ts）と、雨の語・組・高さの線・例文（../public/data）
//   - src/clips.json：鳴らす声それぞれの長さ（映像の時はこの長さから：src/timeline.ts）
//   - アプリの字（IBM Plex Sans・IBM Plex Sans JP・Noto Sans SC・しっぽり明朝）。Google Fonts の倉庫（OFL）からまるごと取り、
//     映像の元（src/）に出てくる字だけに切る（Python の fontTools）。言葉を変えたら、もう一度走らせる。
//   node scripts/assets.mjs        (npm run assets)
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ja } from "../../src/lib/i18n/ja.ts";
import { ORDER } from "../../src/lib/rain-core.ts";

const APP = "..";
const WHOLE = "node_modules/.cache/fonts";
const RAW = "node_modules/.cache/raw";

/** 雨：2声と3声（t23）の6組。a・b はアプリのデータの順。 */
const PAIRS = [
  ["da4xue2-858b", "da4xue3-7c72"],
  ["mai2-2c49", "mai3-b6c5"],
  ["tang2-3d8c", "tang3-a854"],
  ["yu2-9246", "yu3-8995"],
  ["you2-2407", "you3-fbd5"],
  ["bai2-4a1a", "bai3-5013"],
];
/** 問い：アプリの紹介ページと同じ3組（大学/大雪、肚子/兔子、人民/人名）。 */
const HOOK = [
  ["t23", "da4xue2-858b", "da4xue3-7c72"],
  ["asp", "du4zi5-e102", "tu4zi5-3daa"],
  ["nng", "ren2min2-4c4d", "ren2ming2-0947"],
];
/** 映像で鳴らすアプリの声（<voice>/<id>）。src/timeline.ts で鳴らすものと同じ（ほかは写さない）。 */
const CLIPS = [
  "erinome/da4xue2-858b", // 問い（紹介ページの声）、聞き分ける 2 / 12
  "erinome/da4xue3-7c72",
  "kore/da4xue2-858b", // 聞き比べる 1組目、言ってみる の手本
  "kore/da4xue3-7c72",
  "erinome/mai2-2c49", // 聞き比べる 2組目
  "erinome/mai3-b6c5",
  "charon/da4xue3-7c72", // 大雪 を押して、また次の声で
  "kore/tang3-a854", // 聞き分ける 1 / 12
  "iapetus/da4xue2-858b", // 言ってみる：学習者の声の代わり（scripts/say.mjs と同じ）
  "iapetus/yu3-8995", // 数日後 12 / 12
];
/**
 * 自分 の画面に出す記録の例（数日後の場面）。学習者の本当の記録は無いので、映像のために置いた値（README に書いてある）。
 * 浴びた雨は 違いごと の回数の和。違いはアプリの順（rain-core の ORDER）で最初の3つ。
 */
const EXAMPLE = { families: { t14: { rains: 5 }, t23: { rains: 6, splitAt: "2026-10-30T12:00:00+09:00" }, asp: { rains: 3, owed: 2 } }, said: 11 };
const FONTS = {
  "IBMPlexSans.ttf": "ibmplexsans/IBMPlexSans%5Bwdth,wght%5D.ttf",
  "IBMPlexSansJP-Regular.ttf": "ibmplexsansjp/IBMPlexSansJP-Regular.ttf",
  "IBMPlexSansJP-Medium.ttf": "ibmplexsansjp/IBMPlexSansJP-Medium.ttf",
  "IBMPlexSansJP-SemiBold.ttf": "ibmplexsansjp/IBMPlexSansJP-SemiBold.ttf",
  "NotoSansSC.ttf": "notosanssc/NotoSansSC%5Bwght%5D.ttf",
  "ShipporiMincho-Bold.ttf": "shipporimincho/ShipporiMincho-Bold.ttf",
};

for (const d of ["public/app/clips", "public/app/lines", "public/fonts", WHOLE, RAW]) mkdirSync(d, { recursive: true });
copyFileSync(`${APP}/public/icons/icon-512.png`, "public/app/icon.png");

// ---- 声：WAV にして、大きさをそろえる ------------------------------------------------------------------------------

function ffmpeg(args) {
  const r = spawnSync("npx", ["remotion", "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8", shell: true });
  if (r.status !== 0) throw new Error(r.stderr);
}

/** WAV（16bit・モノ）の中身。 */
function readWav(file) {
  const b = readFileSync(file);
  let at = 12;
  let rate = 0;
  while (at + 8 <= b.length) {
    const id = b.toString("ascii", at, at + 4);
    const size = b.readUInt32LE(at + 4);
    if (id === "fmt ") rate = b.readUInt32LE(at + 12);
    if (id === "data") return { rate, samples: new Int16Array(b.buffer.slice(b.byteOffset + at + 8, b.byteOffset + at + 8 + size)) };
    at += 8 + size + (size % 2);
  }
  throw new Error(`${file}: data が無い`);
}

function writeWav(file, samples, rate) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(samples[i], 44 + i * 2);
  writeFileSync(file, buf);
}

const TARGET_DB = -17;
const CEILING_DB = -1;

/**
 * 声のある所（50ms ごとの RMS がフルスケールの 1% を超える所）の大きさを TARGET_DB に。ピークは CEILING_DB を超えない
 * （超えるなら上げ幅を抑える）。Remotion の ffmpeg には ebur128 が無いので、ここで測る。
 */
function level(from, to) {
  const tmp = `${RAW}/level.wav`;
  ffmpeg(["-i", from, "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le", tmp]);
  const { rate, samples } = readWav(tmp);
  const win = Math.floor(rate / 20);
  let sum = 0;
  let n = 0;
  let peak = 0;
  for (let i = 0; i + win <= samples.length; i += win) {
    let s = 0;
    for (let k = i; k < i + win; k++) s += samples[k] * samples[k];
    const rms = Math.sqrt(s / win) / 32768;
    if (rms > 0.01) {
      sum += rms * rms;
      n++;
    }
  }
  for (const x of samples) peak = Math.max(peak, Math.abs(x));
  const active = 20 * Math.log10(Math.sqrt(sum / Math.max(1, n)));
  const gain = Math.min(TARGET_DB - active, CEILING_DB - 20 * Math.log10(peak / 32768));
  const k = Math.pow(10, gain / 20);
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] * k)));
  writeWav(to, out, rate);
  return { seconds: samples.length / rate, gain };
}

const lengths = {};
for (const c of CLIPS) {
  const from = `${APP}/public/audio/${c}.mp3`;
  if (!existsSync(from)) throw new Error(`アプリに ${c} の声が無い（${from}）`);
  mkdirSync(`public/app/clips/${c.split("/")[0]}`, { recursive: true });
  lengths[c] = Math.round(level(from, `public/app/clips/${c}.wav`).seconds * 1000) / 1000;
}
// 前に写して、もう鳴らさない声は消す（rmSync は、この Windows では消えたと言って残ることがあった）。
for (const v of readdirSync("public/app/clips")) {
  for (const f of readdirSync(`public/app/clips/${v}`)) if (!CLIPS.includes(`${v}/${f.replace(/\.wav$/, "")}`)) unlinkSync(`public/app/clips/${v}/${f}`);
}

// ---- 雨のデータ：語、組、高さの線、例文 ------------------------------------------------------------------------------

const family = (id) => JSON.parse(readFileSync(`${APP}/public/data/f/${id}.json`, "utf8"));
const index = JSON.parse(readFileSync(`${APP}/public/data/index.json`, "utf8"));
const t23 = family("t23");
const word = (f, id) => {
  const w = f.words[id];
  if (!w) throw new Error(`語が無い：${id}`);
  return { id, hanzi: w.hanzi, pinyin: w.pinyin, ja: w.ja, lines: w.lines };
};
for (const [a, b] of PAIRS) if (!t23.pairs.some((p) => p.a === a && p.b === b)) throw new Error(`組が無い：${a} ${b}`);

// 文の中で：取り違えた組（大学/大雪）の語から、その語の最初の例文を一つずつ（アプリの sentencesFor と同じ）。
const SENTENCE_OF = ["da4xue2-858b", "da4xue3-7c72"];
const sentences = SENTENCE_OF.map((id, i) => {
  const s = t23.sentences[id]?.[0];
  if (!s) throw new Error(`例文が無い：${id}`);
  return { word: id, ...s, file: `app/lines/s${i + 1}.wav` };
});
// 鳴らすのは1つ目だけ（アプリは文が出て 400ms で1つ目を流す）。2つ目は画面に出るだけ。
if (existsSync("public/app/lines/s2.wav")) unlinkSync("public/app/lines/s2.wav");
for (const [i, s] of sentences.slice(0, 1).entries()) {
  const raw = `${RAW}/s${i + 1}.wav`;
  if (!existsSync(raw)) {
    const res = await fetch(s.audio);
    if (!res.ok) throw new Error(`例文の声：${res.status}`);
    writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  }
  lengths[`s${i + 1}`] = Math.round(level(raw, `public/${s.file}`).seconds * 1000) / 1000;
}
writeFileSync("src/clips.json", `${JSON.stringify(lengths, null, 1)}\n`);
console.log(`  声 ${CLIPS.length}、例文の声 1`);

// ---- アプリの言葉（ja.ts）。関数は、映像で使う値で呼んでおく ---------------------------------------------------------

const r = ja.rain;
const copy = {
  name: ja.name,
  intro: { lead: ja.intro.lead, body: ja.intro.body, note: ja.intro.note },
  nav: ja.nav,
  steps: ja.steps,
  rain: {
    compareLead: r.compareLead,
    soundOn: r.soundOn,
    tapToHear: r.tapToHear,
    replayAll: r.replayAll,
    toTell: r.toTell,
    tellLead: r.tellLead,
    hearAgain: r.hearAgain,
    next: r.next,
    trial1: r.trialOf(1, 12),
    trial2: r.trialOf(2, 12),
    trial12: r.trialOf(12, 12),
    heardRight: r.heardRight,
    heardWrong: r.heardWrong,
    revealTitle: r.revealTitle,
    comesBack: r.comesBack,
    toSentences: r.toSentences,
    toSay: r.toSay,
    sentencesLead: r.sentencesLead,
    showTranslation: r.showTranslation,
    sayLead: r.sayLead,
    record: r.record,
    recording: r.recording,
    analysing: r.analysing,
    yourLine: r.yourLine,
    modelLine: r.modelLine,
    heard: r.heard,
    through: r.through,
    nearerDaxue: r.nearer(t23.words["da4xue2-858b"].hanzi),
    nextRain: r.nextRain,
    splitNow: r.splitNow(ja.families.t23.name),
  },
  family: ja.families.t23,
  me: {
    title: ja.me.title,
    lead: ja.me.lead,
    sofar: ja.me.sofar,
    stats: ja.me.stats,
    statUnits: ja.me.statUnits,
    sofarNote: ja.me.sofarNote,
    views: ja.me.views,
    localShort: ja.me.localShort,
    connect: ja.me.connect,
    // 例の記録を、アプリの言い方（関数）で。違いの並びは 自分 と同じ ORDER の順。
    example: (() => {
      const bathed = ORDER.filter((id) => EXAMPLE.families[id]);
      return {
        rains: bathed.reduce((n, id) => n + EXAMPLE.families[id].rains, 0),
        families: bathed.length,
        said: EXAMPLE.said,
        notYet: ja.me.notYet(ORDER.length - bathed.length),
        rows: bathed.map((id) => {
          const f = EXAMPLE.families[id];
          return {
            id,
            name: ja.families[id].name,
            meta: ja.me.familyRains(f.rains),
            ...(f.splitAt ? { split: ja.me.splitSince(new Date(f.splitAt).toLocaleDateString("ja-JP", { month: "long", day: "numeric", timeZone: "Asia/Tokyo" })) } : {}),
            ...(f.owed ? { owed: ja.me.returningCount(f.owed) } : {}),
          };
        }),
      };
    })(),
  },
};

const app = {
  voices: index.voices,
  rain: { family: "t23", pairs: PAIRS.map(([a, b]) => ({ a, b })), words: Object.fromEntries(PAIRS.flat().map((id) => [id, word(t23, id)])) },
  hook: HOOK.map(([f, a, b]) => ({ a: word(family(f), a), b: word(family(f), b) })),
  sentences,
  copy,
};
writeFileSync("src/app.json", `${JSON.stringify(app, null, 1)}\n`);

// ---- 字：映像の元に出てくる字（と、印字できる ASCII すべて）だけに切る ------------------------------------------------

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const chars = new Set(Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)));
for (const file of walk("src")) for (const ch of readFileSync(file, "utf8")) if (ch > "\u007f") chars.add(ch);
writeFileSync(`${WHOLE}/chars.txt`, [...chars].join(""));

for (const [file, path] of Object.entries(FONTS)) {
  if (!existsSync(`${WHOLE}/${file}`)) {
    const res = await fetch(`https://raw.githubusercontent.com/google/fonts/main/ofl/${path}`);
    if (!res.ok) throw new Error(`${file}: ${res.status}`);
    writeFileSync(`${WHOLE}/${file}`, Buffer.from(await res.arrayBuffer()));
    console.log(`  font ${file}`);
  }
  const cut = spawnSync(
    "python",
    ["-m", "fontTools.subset", `${WHOLE}/${file}`, `--text-file=${WHOLE}/chars.txt`, `--output-file=public/fonts/${file}`, "--layout-features=*", "--no-hinting"],
    { encoding: "utf8" },
  );
  if (cut.status !== 0) throw new Error(`cutting ${file} (pip install fonttools): ${cut.stderr}`);
}
console.log(`  fonts cut to ${chars.size} characters`);
