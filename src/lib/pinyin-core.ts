/**
 * Pinyin, taken apart: each syllable's initial, final and tone, the tones as they are actually said (sandhi), and what
 * kind of difference separates two words. Pure, for the app, the scripts and the tests alike.
 */

export type Tone = 1 | 2 | 3 | 4 | 5;

export type Syllable = {
  /** As written, tone mark and all: "mǎi". */
  text: string;
  /** "" for a syllable with no initial (an, ér; y- and w- are spelling, not initials). */
  initial: string;
  /** The final as it sounds, spelling conventions undone: yu → ü, ju → jü, ui → uei, zhi → -i. */
  final: string;
  /** 5 for the neutral tone (no mark). */
  tone: Tone;
};

const MARKS: Record<string, [string, Tone]> = {
  ā: ["a", 1], á: ["a", 2], ǎ: ["a", 3], à: ["a", 4],
  ē: ["e", 1], é: ["e", 2], ě: ["e", 3], è: ["e", 4],
  ī: ["i", 1], í: ["i", 2], ǐ: ["i", 3], ì: ["i", 4],
  ō: ["o", 1], ó: ["o", 2], ǒ: ["o", 3], ò: ["o", 4],
  ū: ["u", 1], ú: ["u", 2], ǔ: ["u", 3], ù: ["u", 4],
  ǖ: ["ü", 1], ǘ: ["ü", 2], ǚ: ["ü", 3], ǜ: ["ü", 4],
};

const INITIALS = ["zh", "ch", "sh", "b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "j", "q", "x", "r", "z", "c", "s"];
const APICAL = new Set(["z", "c", "s", "zh", "ch", "sh", "r"]);
const PALATAL = new Set(["j", "q", "x"]);

/** Splits "mǎi" into its letters without the mark, and the tone. Returns null for anything that is not one syllable. */
function stripTone(syllable: string): { base: string; tone: Tone } | null {
  let tone: Tone = 5;
  let base = "";
  for (const ch of syllable.normalize("NFC").toLowerCase()) {
    const mark = MARKS[ch];
    if (mark) {
      if (tone !== 5) return null; // two marks
      base += mark[0];
      tone = mark[1];
    } else base += ch;
  }
  base = base.replace(/u:|v/g, "ü");
  if (!/^[a-zü]+$/.test(base)) return null;
  return { base, tone };
}

/** The sounding final from the spelled one, given the initial ("" when the syllable starts with y, w or a vowel). */
function soundingFinal(initial: string, spelled: string): string {
  let f = spelled;
  if (PALATAL.has(initial)) f = f.replace(/^u/, "ü");
  if (f === "iu") f = "iou";
  else if (f === "ui") f = "uei";
  else if (f === "un") f = "uen";
  if (f === "i" && APICAL.has(initial)) f = "-i";
  return f;
}

function zeroInitialFinal(base: string): string | null {
  if (base.startsWith("y")) {
    const rest = base.slice(1);
    if (rest === "i" || rest === "in" || rest === "ing") return rest;
    if (rest.startsWith("u")) return "ü" + rest.slice(1); // yu, yue, yuan, yun
    if (rest === "ou") return "iou";
    return "i" + rest; // ya, ye, yao, yan, yang, yong
  }
  if (base.startsWith("w")) {
    const rest = base.slice(1);
    if (rest === "u") return "u";
    if (rest === "ei") return "uei";
    if (rest === "en") return "uen";
    return "u" + rest; // wa, wo, wai, wan, wang, weng
  }
  return base; // a, ai, an, ang, ao, e, ei, en, eng, er, o, ou
}

export function parseSyllable(text: string): Syllable | null {
  const stripped = stripTone(text);
  if (!stripped) return null;
  const { base, tone } = stripped;
  if (/^[yw]/.test(base)) {
    const final = zeroInitialFinal(base);
    return final ? { text, initial: "", final, tone } : null;
  }
  const initial = INITIALS.find((i) => base.startsWith(i)) ?? "";
  const spelled = base.slice(initial.length);
  if (!spelled) return null;
  return { text, initial, final: soundingFinal(initial, spelled), tone };
}

/** "dà xué" → syllables, or null if any part is not a syllable. */
export function parsePinyin(pinyin: string): Syllable[] | null {
  const parts = pinyin.trim().split(/\s+/).filter(Boolean);
  const out: Syllable[] = [];
  for (const p of parts) {
    const s = parseSyllable(p);
    if (!s) return null;
    out.push(s);
  }
  return out.length ? out : null;
}

/** "mǎi" → "mai3", "lǜ" → "lv4", "ma" (neutral) → "ma5". For ids and file names. */
export function numbered(syllable: string): string {
  const s = stripTone(syllable);
  return s ? `${s.base.replace(/ü/g, "v")}${s.tone}` : syllable;
}

/**
 * The tones as said in the word. Two third tones in a row: all but the last become second (你好 ní hǎo). 不 becomes
 * bú before a fourth tone; 一 becomes yí before a fourth tone and yì before the others (not at the end of the word).
 */
export function surfaceTones(hanzi: string, tones: Tone[]): Tone[] {
  const out = [...tones];
  const chars = [...hanzi];
  for (let i = 0; i < out.length - 1; i++) {
    const next = tones[i + 1];
    if (chars[i] === "不" && tones[i] === 4 && next === 4) out[i] = 2;
    if (chars[i] === "一" && tones[i] === 1 && next !== 5) out[i] = next === 4 ? 2 : 4;
  }
  // Third tones before a third tone, from the right: in 3-3-3 every one but the last rises.
  for (let i = out.length - 2; i >= 0; i--) {
    if (tones[i] === 3 && tones[i + 1] === 3) out[i] = 2;
  }
  return out;
}

export type Contrast =
  | "tone" // only tones differ (as said, after sandhi)
  | "aspiration" // b/p d/t g/k j/q zh/ch z/c
  | "retroflex" // zh/z ch/c sh/s
  | "palatal" // j/zh q/ch x/sh
  | "r-l"
  | "f-h"
  | "n-ng" // -n / -ng at the end of the syllable
  | "u-ü"
  | "ou-uo";

const ASPIRATION: [string, string][] = [["b", "p"], ["d", "t"], ["g", "k"], ["j", "q"], ["zh", "ch"], ["z", "c"]];
const RETROFLEX: [string, string][] = [["zh", "z"], ["ch", "c"], ["sh", "s"]];
const PALATAL_PAIRS: [string, string][] = [["j", "zh"], ["q", "ch"], ["x", "sh"]];
// What a palatal final sounds like without its i/ü glide, to compare ji with zhi, xiao with shao, jin with zhen.
const WITHOUT_GLIDE: Record<string, string> = {
  i: "-i", ia: "a", iao: "ao", ie: "e", iou: "ou", ian: "an", in: "en", iang: "ang", ing: "eng", iong: "ong",
  ü: "u", üan: "uan", ün: "uen",
};

const isPair = (pairs: [string, string][], a: string, b: string) =>
  pairs.some(([p, q]) => (p === a && q === b) || (p === b && q === a));

/** What separates two syllables with the same tone that differ in exactly one sound, or null. */
function segmentContrast(a: Syllable, b: Syllable): Contrast | null {
  if (a.initial !== b.initial && a.final === b.final) {
    if (isPair(ASPIRATION, a.initial, b.initial)) return "aspiration";
    if (isPair(RETROFLEX, a.initial, b.initial)) return "retroflex";
    if (isPair([["r", "l"]], a.initial, b.initial)) return "r-l";
    if (isPair([["f", "h"]], a.initial, b.initial)) return "f-h";
    return null;
  }
  if (a.initial !== b.initial && isPair(PALATAL_PAIRS, a.initial, b.initial)) {
    const [pal, ret] = PALATAL.has(a.initial) ? [a, b] : [b, a];
    return WITHOUT_GLIDE[pal.final] === ret.final ? "palatal" : null;
  }
  if (a.initial === b.initial && a.final !== b.final) {
    const [x, y] = [a.final, b.final];
    if (x.endsWith("ng") !== y.endsWith("ng") && x.replace(/ng$/, "n") === y.replace(/ng$/, "n")) return "n-ng";
    if (x.replace(/^ü/, "u") === y.replace(/^ü/, "u") && x[0] !== y[0]) return "u-ü";
    if (isPair([["ou", "uo"]], x, y)) return "ou-uo";
  }
  return null;
}

export type Word = { hanzi: string; pinyin: string };

export type PairKind = {
  contrast: Contrast;
  /** Which syllables differ. */
  at: number[];
  /** Tone contrasts: the two words' tones as said, e.g. [[2], [3]] for 大学 / 大雪 at syllable 1. */
  surface?: [Tone[], Tone[]];
};

/**
 * What kind of minimal pair two words make, or null when they are not one: a different number of syllables, the
 * same sound (after sandhi: 买马 and 埋马 are both said mái mǎ), or more than one kind of difference.
 */
export function classifyPair(a: Word, b: Word): PairKind | null {
  const sa = parsePinyin(a.pinyin);
  const sb = parsePinyin(b.pinyin);
  if (!sa || !sb || sa.length !== sb.length) return null;
  const ta = surfaceTones(a.hanzi, sa.map((s) => s.tone));
  const tb = surfaceTones(b.hanzi, sb.map((s) => s.tone));

  const segmentDiffs: number[] = [];
  const toneDiffs: number[] = [];
  for (let i = 0; i < sa.length; i++) {
    if (sa[i].initial !== sb[i].initial || sa[i].final !== sb[i].final) segmentDiffs.push(i);
    if (ta[i] !== tb[i]) toneDiffs.push(i);
  }

  if (segmentDiffs.length === 0) {
    if (toneDiffs.length === 0) return null; // homophones as said
    return { contrast: "tone", at: toneDiffs, surface: [toneDiffs.map((i) => ta[i]), toneDiffs.map((i) => tb[i])] };
  }
  if (segmentDiffs.length !== 1 || toneDiffs.length !== 0) return null;
  const i = segmentDiffs[0];
  const contrast = segmentContrast(sa[i], sb[i]);
  return contrast ? { contrast, at: [i] } : null;
}

const FAMILY_OF: Record<Exclude<Contrast, "tone">, string> = {
  aspiration: "asp",
  retroflex: "retro",
  palatal: "pal",
  "n-ng": "nng",
  "u-ü": "uv",
  "r-l": "rl",
  "f-h": "fh",
  "ou-uo": "ouuo",
};

/** The difference (family id) a pair belongs to: t23 for a 2/3 tone pair, tw for two tones apart, nng, asp … */
export function familyOfPair(kind: PairKind): string {
  if (kind.contrast !== "tone") return FAMILY_OF[kind.contrast];
  if (kind.at.length > 1) return "tw";
  const pair = [kind.surface![0][0], kind.surface![1][0]].sort();
  return pair.includes(5) ? "t5" : `t${pair[0]}${pair[1]}`;
}
