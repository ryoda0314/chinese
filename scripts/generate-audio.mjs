// Makes, checks and publishes the word clips: every word in data/words.json, in each voice.
//
// A clip is used only if a machine agrees it says the word:
//   - a recognizer (gpt-4o-transcribe, then gpt-transcribe as a second opinion) hears the word's syllables, and never
//     the word it is paired with; when it misses, it is asked again with the two words of each pair named, in both
//     orders, and the clip is let through only if it names this word both times (it leans toward the commoner word);
//   - its pitch line is closer to the same word in the other voices than to the words it is paired with by tone
//     (in every voice), by X_MARGIN. Lines are compared with each other rather than with idealized tone shapes, which
//     miss how a word is really said (a second tone after a fourth starts low and rises late).
//   - a word paired only by sound needs its tones confirmed by the recognizer, or a line that fits its own tones better
//     than those one syllable away.
// Where the recognizer is known to be wrong, the clip's own sound decides instead:
//   - u against ü as the vowel itself (路/绿, 女/努): recognizers swap them in single syllables, consistently, while
//     the clips say them right (Praat's F2: u 470–760 Hz, ü 1700–2500 Hz). The vowel's frontness (src/lib/vowel.ts)
//     must sit on its own side of the voice's u and ü.
//   - a tone partner heard (迷 as 米, 埋 as 买): the recognizer leans toward the commoner word; a line clearly nearer
//     this word (STRONG_X) outweighs it.
//   - an r-ending the recognizer adds (哪 heard as 哪儿) is taken off.
// A clip that fails is made again, up to TRIES times; then it waits in data/review.json for a person to listen.
// Raw generations stay in scripts/work/raw (not committed), so a run can stop anywhere and the same command resumes.
// scripts/publish-audio.mjs then encodes the passing ones for the app.
//
//   node --env-file=.env.local scripts/generate-audio.mjs                 # make what is missing, check, report
//   node --env-file=.env.local scripts/generate-audio.mjs --no-generate   # only check what is there
//   --voices=kore,charon  --limit=40 (words, for a trial)  --concurrency=2
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pinyin } from "pinyin-pro";
import { classifyPair, parsePinyin, surfaceTones } from "../src/lib/pinyin-core.ts";
import { rangeForVoice, trackPitch, voicedPoints } from "../src/lib/pitch.ts";
import { distance, lineDistance, lineOf, rangeFromTones } from "../src/lib/tone.ts";
import { frontness } from "../src/lib/vowel.ts";
import { synthesize, transcribe, withRetry } from "./lib/services.mjs";
import { floatToWav, readWav, tidy } from "./lib/wav.mjs";

export const VOICES = [
  { id: "kore", name: "Kore", sex: "f" },
  { id: "erinome", name: "Erinome", sex: "f" },
  { id: "charon", name: "Charon", sex: "m" },
  { id: "iapetus", name: "Iapetus", sex: "m" },
];
// Tried against an English instruction and none at all: this one read single words most cleanly (scripts/probe-tts.mjs).
const PROMPT = (hanzi) => `用标准普通话，清楚自然地读一遍这个词：\n${hanzi}`;
const TRIES = 3;
const X_MARGIN = 0.05;
const STRONG_X = 0.2;
// A u/ü vowel must be this share of the gap between the voice's u and ü past their midpoint, on its own side.
const VOWEL_MARGIN = 0.2;
const MAX_SAME = 0.45; // a line this far from the same word in the other voices is suspect (about the farthest 2% of passing takes)
const T_MARGIN = 0.1;
const ASR_MODELS = ["gpt-4o-transcribe", "gpt-transcribe"];
const RAW = "scripts/work/raw";

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const voices = arg("voices") ? VOICES.filter((v) => arg("voices").split(",").includes(v.id)) : VOICES;
const CONCURRENCY = Math.max(1, Number(arg("concurrency")) || 2);
const GENERATE = !process.argv.includes("--no-generate");

let words = JSON.parse(readFileSync("data/words.json", "utf8"));
if (arg("limit")) words = words.slice(0, Number(arg("limit")));
const byId = new Map(words.map((w) => [w.id, w]));
const families = JSON.parse(readFileSync("data/families.json", "utf8"));
const tonesOf = (w) => surfaceTones(w.hanzi, parsePinyin(w.pinyin).map((s) => s.tone));
const toneless = (py) => py.normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC");

// Each word's partners: the words it is paired with, and whether by tone.
const partners = new Map(words.map((w) => [w.id, []]));
for (const f of families) {
  for (const p of f.pairs) {
    const a = byId.get(p.a);
    const b = byId.get(p.b);
    if (!a || !b) continue;
    const contrast = classifyPair(a, b).contrast;
    partners.get(a.id).push({ word: b, byTone: contrast === "tone", contrast });
    partners.get(b.id).push({ word: a, byTone: contrast === "tone", contrast });
  }
}

/** Tone patterns one syllable's tone away: what a word paired only by sound must not sound like. */
function neighbours(w) {
  const own = tonesOf(w);
  const out = [];
  own.forEach((t, i) => {
    if (t === 5) return;
    for (const o of [1, 2, 3, 4]) if (o !== t) out.push(own.map((x, k) => (k === i ? o : x)));
  });
  return out;
}

const rawPath = (voice, id, attempt) => `${RAW}/${voice}/${id}.${attempt}.wav`;
const tries = (voice, id) => [0, 1, 2, 3, 4].filter((t) => existsSync(rawPath(voice, id, t)));

// Takes a person listened to and found right (scripts/review-page.mjs): "voice/id.take".
const approved = new Set(existsSync("data/approved.json") ? JSON.parse(readFileSync("data/approved.json", "utf8")) : []);

const asrFile = "data/asr.json";
const asr = existsSync(asrFile) ? JSON.parse(readFileSync(asrFile, "utf8")) : {};
const saveAsr = () => writeFileSync(asrFile, JSON.stringify(asr, null, 1) + "\n");

// ---------------------------------------------------------------- generation

let quotaFailures = 0;
async function generateAll(jobs) {
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < jobs.length && quotaFailures < 3) {
      const job = jobs[next++];
      try {
        const wav = await withRetry(() => synthesize(PROMPT(job.word.hanzi), job.voice.name));
        mkdirSync(`${RAW}/${job.voice.id}`, { recursive: true });
        writeFileSync(rawPath(job.voice.id, job.word.id, job.attempt), wav);
        quotaFailures = 0;
      } catch (err) {
        const msg = String(err?.message ?? err);
        if (/RESOURCE_EXHAUSTED|429/.test(msg)) quotaFailures++;
        console.error(`failed ${job.voice.id}/${job.word.hanzi}: ${msg.slice(0, 160)}`);
      }
      if (++done % 25 === 0) console.log(`  ${done}/${jobs.length} generated`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  if (quotaFailures >= 3) console.log("stopped generating: the quota keeps refusing (run the same command later)");
}

// ---------------------------------------------------------------- measuring

const clean = new Map(); // "voice/id.try" → { samples, rate }
function cleaned(voice, id, attempt) {
  const key = `${voice}/${id}.${attempt}`;
  if (!clean.has(key)) {
    const { rate, samples } = readWav(readFileSync(rawPath(voice, id, attempt)));
    clean.set(key, { rate, samples: tidy(samples, rate) });
  }
  return clean.get(key);
}

/** Every take of a voice, tracked within the voice's own range and drawn on its own levels. */
function measureVoice(voice) {
  const takes = words.flatMap((w) => tries(voice.id, w.id).map((attempt) => ({ w, attempt })));
  if (takes.length === 0) return null;
  const first = takes.map((t) => {
    const c = cleaned(voice.id, t.w.id, t.attempt);
    return { ...t, ...c, frames: trackPitch(c.samples, c.rate) };
  });
  const pitch = rangeForVoice(first.filter((t) => t.attempt === 0).flatMap((t) => t.frames.flatMap((f) => (f.hz ? [f.hz] : []))));
  for (const t of first) t.frames = trackPitch(t.samples, t.rate, pitch);
  const levels = rangeFromTones(
    first.filter((t) => t.attempt === 0).map((t) => ({ tones: tonesOf(t.w), semitones: voicedPoints(t.frames).map(([, s]) => s) })),
  );
  const out = new Map();
  for (const t of first) {
    out.set(`${t.w.id}.${t.attempt}`, {
      seconds: t.samples.length / t.rate,
      line: lineOf(t.frames, levels),
      front: uvClass(t.w) ? frontness(t.samples, t.rate, t.frames) : null,
    });
  }
  // Where this voice's u and ü sit: the medians over the first takes of the u/ü words (nearly all said right).
  const fronts = (cls) => first.filter((t) => t.attempt === 0 && uvClass(t.w) === cls).map((t) => out.get(`${t.w.id}.0`).front);
  const vowels = { u: median(fronts("u")), ü: median(fronts("ü")) };
  return { pitch, levels, takes: out, vowels };
}

/**
 * "u" or "ü" for a word in a u/ü pair whose vowel is u or ü itself (路, 绿, 女, 鱼), else null. Where u or ü is only a
 * glide (玩 wán, 圆 yuán) the frontness is too short to measure, and the recognizer tells those apart anyway.
 */
function uvClass(w) {
  if (!partners.get(w.id)?.some((p) => p.contrast === "u-ü")) return null;
  const final = parsePinyin(w.pinyin)[0].final;
  return final === "ü" ? "ü" : final === "u" ? "u" : null;
}

/** The pinyin of what was heard; an r-ending the recognizer adds to a word without one (哪 → 哪儿) is taken off. */
function readingOf(text, w) {
  let han = (text ?? "").replace(/[^\p{Script=Han}]/gu, "");
  if (w && !w.hanzi.endsWith("儿") && han.length > [...w.hanzi].length) han = han.replace(/儿$/, "");
  return han ? pinyin(han, { toneType: "symbol", type: "array" }).join(" ").normalize("NFC") : "";
}

/** What the recognizers hear, cached by clip; the second model is asked only when the first misses the syllables. */
async function hear(voice, w, attempt) {
  const key = `${voice}/${w.id}.${attempt}`;
  asr[key] ??= {};
  for (const model of ASR_MODELS) {
    if (asr[key][model] === undefined) {
      const c = cleaned(voice, w.id, attempt);
      asr[key][model] = await withRetry(() => transcribe(floatToWav(c.samples, c.rate), model)).catch((e) => `ERROR ${e.message}`);
    }
    if (toneless(readingOf(asr[key][model], w)) === toneless(w.pinyin)) break;
  }
  const free = Object.entries(asr[key]).filter(([m]) => ASR_MODELS.includes(m)).map(([, t]) => readingOf(t, w));
  if (!free.some((r) => r === w.pinyin.normalize("NFC"))) {
    asr[key].forced ??= {};
    for (const p of partners.get(w.id)) {
      if (asr[key].forced[p.word.id]) continue;
      const c = cleaned(voice, w.id, attempt);
      const wav = floatToWav(c.samples, c.rate);
      const both = [];
      for (const order of [[w.hanzi, p.word.hanzi], [p.word.hanzi, w.hanzi]]) {
        both.push(await withRetry(() => transcribe(wav, ASR_MODELS[0], order)).catch((e) => `ERROR ${e.message}`));
      }
      asr[key].forced[p.word.id] = both;
    }
  }
  return asr[key];
}

/** Whether the two-choice recognizer named this word both times against every partner it was asked about. */
function forcedConfirms(heard, w) {
  const forced = Object.values(heard.forced ?? {});
  return forced.length > 0 && forced.every((both) => both.every((t) => (t ?? "").replace(/[^\p{Script=Han}]/gu, "") === w.hanzi));
}

async function hearAll(measured) {
  const jobs = [];
  for (const voice of voices) {
    for (const w of words) for (const attempt of tries(voice.id, w.id)) if (measured.get(voice.id)) jobs.push({ voice, w, attempt });
  }
  let n = 0;
  async function worker() {
    while (jobs.length) {
      const j = jobs.shift();
      await hear(j.voice.id, j.w, j.attempt);
      if (++n % 100 === 0) {
        console.log(`  ${n} heard`);
        saveAsr();
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  saveAsr();
}

// ---------------------------------------------------------------- deciding

const median = (xs) => {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
  return s.length ? s[s.length >> 1] : Infinity;
};

function judge(voice, w, attempt, measured, chosen) {
  const m = measured.get(voice.id);
  const take = m.takes.get(`${w.id}.${attempt}`);
  const heard = asr[`${voice.id}/${w.id}.${attempt}`] ?? {};
  const readings = ASR_MODELS.filter((k) => heard[k] !== undefined).map((k) => readingOf(heard[k], w));
  const confirmed = forcedConfirms(heard, w);
  const target = w.pinyin.normalize("NFC");
  const vowel = uvClass(w);
  // For a u/ü word the recognizer's u and ü are not believed: syllables are compared with them taken as one.
  const flat = (py) => (vowel ? toneless(py).replace(/ü/g, "u") : toneless(py));
  const syllablesHeard = readings.some((r) => flat(r) === flat(target));
  const tonesHeard = readings.some((r) => r === target);

  // The same word in the other voices, and each tone partner in every voice, as currently chosen.
  const lineOfChosen = (v, id) => {
    const a = chosen.get(`${v.id}/${id}`) ?? 0;
    return measured.get(v.id)?.takes.get(`${id}.${a}`)?.line;
  };
  const others = voices.filter((v) => v.id !== voice.id);
  const same = median(others.map((v) => lineOfChosen(v, w.id)).filter(Boolean).map((l) => lineDistance(take.line, l)));
  const toneRivals = partners.get(w.id).filter((p) => p.byTone);
  const rival = Math.min(
    ...toneRivals.map((p) => median(voices.map((v) => lineOfChosen(v, p.word.id)).filter(Boolean).map((l) => lineDistance(take.line, l)))),
  );
  const xMargin = toneRivals.length ? rival - same : null;
  const own = distance(take.line, tonesOf(w));
  const tMargin = Math.min(...neighbours(w).map((t) => distance(take.line, t) - own));

  // A partner the recognizer heard, unless it is one it cannot be believed about.
  const lineIsClear = xMargin !== null && xMargin >= STRONG_X;
  const partnerHeard = partners.get(w.id).find((p) => {
    if (p.contrast === "u-ü") return false;
    if (p.byTone) return !lineIsClear && readings.some((r) => r === p.word.pinyin);
    return readings.some((r) => toneless(r) === toneless(p.word.pinyin));
  });
  // Its vowel on its own side of this voice's u and ü.
  let vowelOk = true;
  if (vowel) {
    const { u, ü } = m.vowels;
    const mid = (u + ü) / 2;
    const room = VOWEL_MARGIN * (ü - u);
    vowelOk = take.front !== null && Number.isFinite(mid) && (vowel === "ü" ? take.front >= mid + room : take.front <= mid - room);
  }

  let ok = false;
  let why = "";
  if (approved.has(`${voice.id}/${w.id}.${attempt}`)) ok = true;
  else if (take.seconds < 0.25 || take.seconds > 2.5) why = `${take.seconds.toFixed(2)} s long`;
  else if (!vowelOk) why = `vowel not ${vowel} (frontness ${take.front?.toFixed(1)} dB)`;
  else if (partnerHeard && !confirmed) why = `heard as ${partnerHeard.word.hanzi}`;
  else if (!syllablesHeard && !confirmed) why = `heard ${ASR_MODELS.map((k) => heard[k]).filter(Boolean).join(" / ")}`;
  else if (Number.isFinite(same) && same > MAX_SAME) why = `unlike the other voices (${same.toFixed(2)})`;
  else if (xMargin !== null) {
    ok = xMargin >= X_MARGIN || ((tonesHeard || confirmed) && xMargin >= 0);
    if (!ok) why = `tone line nearer its partner (${xMargin.toFixed(2)})`;
  } else {
    ok = tonesHeard || confirmed || tMargin >= T_MARGIN;
    if (!ok) why = `tones unclear (${tMargin.toFixed(2)})`;
  }
  const score = (ok ? 10 : 0) + (xMargin ?? tMargin) - (Number.isFinite(same) ? same : 0);
  return {
    attempt, ok, why, score, seconds: take.seconds, xMargin, tMargin, same, front: take.front,
    heard: readings.at(-1) ?? "", line: take.line,
  };
}

function decide(measured, previousChosen) {
  // Twice: the second pass compares against the takes the first pass chose.
  let chosen = new Map(previousChosen);
  let results = new Map();
  for (let pass = 0; pass < 2; pass++) {
    results = new Map();
    for (const voice of voices) {
      if (!measured.get(voice.id)) continue;
      for (const w of words) {
        const judged = tries(voice.id, w.id).map((a) => judge(voice, w, a, measured, chosen));
        if (!judged.length) continue;
        const best = judged.reduce((b, j) => (j.score > b.score ? j : b));
        const status = best.ok ? "pass" : judged.length >= TRIES ? "review" : "retry";
        results.set(`${voice.id}/${w.id}`, { ...best, status, tries: judged.length, why: best.ok ? "" : judged.map((j) => j.why).join("; ") });
      }
    }
    chosen = new Map([...results].map(([k, r]) => [k, r.attempt]));
  }
  return results;
}

// ---------------------------------------------------------------- run

const clipsFile = "data/clips.json";
const state = existsSync(clipsFile) ? JSON.parse(readFileSync(clipsFile, "utf8")) : { voices: [], clips: {} };

for (let round = 0; round <= TRIES; round++) {
  if (GENERATE) {
    const jobs = [];
    for (const voice of voices) {
      for (const w of words) {
        const have = tries(voice.id, w.id);
        const s = state.clips[`${voice.id}/${w.id}`];
        if (have.length === 0) jobs.push({ voice, word: w, attempt: 0 });
        else if (s?.status === "retry" && have.length < TRIES && have.length <= s.tries) jobs.push({ voice, word: w, attempt: Math.max(...have) + 1 });
      }
    }
    if (jobs.length === 0 && round > 0) break;
    if (jobs.length) {
      console.log(`round ${round}: generating ${jobs.length} clips`);
      await generateAll(jobs);
    }
  }

  const measured = new Map(voices.map((v) => [v.id, measureVoice(v)]));
  await hearAll(measured);
  const chosen = new Map(Object.entries(state.clips).map(([k, c]) => [k, c.attempt]));
  const results = decide(measured, chosen);
  for (const voice of voices) {
    const m = measured.get(voice.id);
    if (!m) continue;
    state.voices = state.voices.filter((v) => v.id !== voice.id);
    state.voices.push({
      ...voice,
      floor: Math.round(m.pitch.floor),
      ceiling: Math.round(m.pitch.ceiling),
      lo: +m.levels.lo.toFixed(2),
      hi: +m.levels.hi.toFixed(2),
      u: +m.vowels.u.toFixed(1),
      ü: +m.vowels.ü.toFixed(1),
    });
  }
  state.voices.sort((a, b) => VOICES.findIndex((v) => v.id === a.id) - VOICES.findIndex((v) => v.id === b.id));
  for (const [k, r] of results) state.clips[k] = r;
  writeFileSync(clipsFile, JSON.stringify(state) + "\n");
  if (!GENERATE || quotaFailures >= 3) break;
}

// Report.
const review = [];
for (const voice of voices) {
  const mine = words.map((w) => state.clips[`${voice.id}/${w.id}`]).filter(Boolean);
  const count = (s) => mine.filter((c) => c.status === s).length;
  console.log(`${voice.id}: ${count("pass")} pass, ${count("retry")} to make again, ${count("review")} for a person, ${words.length - mine.length} missing`);
  for (const w of words) {
    const c = state.clips[`${voice.id}/${w.id}`];
    if (c?.status === "review") review.push({ voice: voice.id, id: w.id, hanzi: w.hanzi, pinyin: w.pinyin, why: c.why, file: rawPath(voice.id, w.id, c.attempt) });
  }
}
writeFileSync("data/review.json", JSON.stringify(review, null, 1) + "\n");
if (review.length) console.log(`${review.length} clips wait for a person: data/review.json`);
