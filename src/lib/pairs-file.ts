/**
 * data/pairs.txt, read and changed by the admin page: one pair per line under "## <difference>", a word written as
 * 漢字 pinyin 意味 (the meaning only where the word first appears). Changes keep the file a person can read and edit:
 * a removed pair is commented out (`#外した `), never deleted, and a meaning it carried moves to the word's next line.
 * Pure; scripts/check-data.mjs remains the judge of the whole file.
 */
import { classifyPair, familyOfPair, parsePinyin } from "./pinyin-core.ts";

export type Side = { hanzi: string; pinyin: string; ja: string };
export type PairLine = { index: number; family: string; a: Side; b: Side };

const REMOVED = "#外した ";

function side(text: string): Side | null {
  const tokens = text.trim().split(/\s+/);
  const hanzi = tokens[0] ?? "";
  const n = [...hanzi].length;
  if (!n) return null;
  return {
    hanzi,
    pinyin: tokens
      .slice(1, 1 + n)
      .join(" ")
      .normalize("NFC"),
    ja: tokens.slice(1 + n).join(" "),
  };
}

const write = (s: Side, withMeaning: boolean) => `${s.hanzi} ${s.pinyin}${withMeaning && s.ja ? ` ${s.ja}` : ""}`;
const same = (x: Pick<Side, "hanzi" | "pinyin">, y: Pick<Side, "hanzi" | "pinyin">) =>
  x.hanzi === y.hanzi && x.pinyin.normalize("NFC") === y.pinyin.normalize("NFC");

/** Every pair line, with its difference and its index among the file's lines. */
export function parsePairs(text: string): { families: string[]; pairs: PairLine[] } {
  const families: string[] = [];
  const pairs: PairLine[] = [];
  let family = "";
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    const header = line.match(/^##\s+(\S+)/);
    if (header) {
      family = header[1];
      if (!families.includes(family)) families.push(family);
      return;
    }
    if (!line || line.startsWith("#") || !family) return;
    const parts = line.split("|");
    if (parts.length !== 2) return;
    const a = side(parts[0]);
    const b = side(parts[1]);
    if (a && b) pairs.push({ index, family, a, b });
  });
  return { families, pairs };
}

/** A word's meaning as the file has it (from wherever it is written). */
export function meaningOf(text: string, w: Pick<Side, "hanzi" | "pinyin">): string {
  for (const p of parsePairs(text).pairs) for (const s of [p.a, p.b]) if (same(s, w) && s.ja) return s.ja;
  return "";
}

function rewrite(text: string, edit: (lines: string[]) => void): string {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  edit(lines);
  return lines.join(eol);
}

const lineOf = (p: PairLine, aMeaning: boolean, bMeaning: boolean) =>
  `${write(p.a, aMeaning)} | ${write(p.b, bMeaning)}`;

/** Comments the pair out; a meaning written only there moves to the word's next appearance. */
export function removePair(text: string, a: Pick<Side, "hanzi" | "pinyin">, b: Pick<Side, "hanzi" | "pinyin">): string {
  const { pairs } = parsePairs(text);
  const target = pairs.find((p) => (same(p.a, a) && same(p.b, b)) || (same(p.a, b) && same(p.b, a)));
  if (!target) throw new Error("その組は見つかりません");
  return rewrite(text, (lines) => {
    lines[target.index] = `${REMOVED}${lines[target.index].trim()}`;
    for (const s of [target.a, target.b]) {
      if (!s.ja) continue;
      const next = pairs.find((p) => p.index > target.index && (same(p.a, s) || same(p.b, s)));
      if (!next) continue;
      const aHere = same(next.a, s);
      const keepA = aHere || Boolean(next.a.ja);
      const keepB = !aHere || Boolean(next.b.ja);
      const withMeaning = {
        ...next,
        a: aHere ? { ...next.a, ja: s.ja } : next.a,
        b: aHere ? next.b : { ...next.b, ja: s.ja },
      };
      lines[next.index] = lineOf(withMeaning, keepA, keepB);
      // A later appearance now carries it too.
      const i = pairs.indexOf(next);
      pairs[i] = withMeaning;
    }
  });
}

/** The word's meaning, changed wherever the file writes it. */
export function setMeaning(text: string, w: Pick<Side, "hanzi" | "pinyin">, ja: string): string {
  const meaning = ja.trim().replace(/\s+/g, " ").replace(/\|/g, "／");
  if (!meaning) throw new Error("意味が空です");
  const { pairs } = parsePairs(text);
  const where = pairs.filter((p) => same(p.a, w) || same(p.b, w));
  if (!where.length) throw new Error("その語は見つかりません");
  const written = where.filter((p) => (same(p.a, w) && p.a.ja) || (same(p.b, w) && p.b.ja));
  const targets = written.length ? written : [where[0]];
  return rewrite(text, (lines) => {
    for (const p of targets) {
      const a = same(p.a, w) ? { ...p.a, ja: meaning } : p.a;
      const b = same(p.b, w) ? { ...p.b, ja: meaning } : p.b;
      lines[p.index] = lineOf({ ...p, a, b }, Boolean(a.ja), Boolean(b.ja));
    }
  });
}

/** Why a new pair cannot go in, or null when it can. */
export function checkNewPair(text: string, family: string, a: Side, b: Side): string | null {
  for (const s of [a, b]) {
    if (!s.hanzi || !/^\p{Script=Han}+$/u.test(s.hanzi)) return `「${s.hanzi}」は漢字で書いてください`;
    const syl = parsePinyin(s.pinyin);
    if (!syl || syl.length !== [...s.hanzi].length)
      return `${s.hanzi} のピンインは、1字に1音節、声調記号つきで（軽声は記号なし）`;
  }
  const { pairs } = parsePairs(text);
  // A word reads one way throughout (a character with two readings is a different word only by meaning).
  for (const s of [a, b]) {
    for (const p of pairs) {
      for (const o of [p.a, p.b]) {
        if (o.hanzi === s.hanzi && !same(o, s)) return `${s.hanzi} はほかの組で ${o.pinyin} と読んでいます`;
      }
    }
  }
  const kind = classifyPair({ hanzi: a.hanzi, pinyin: a.pinyin }, { hanzi: b.hanzi, pinyin: b.pinyin });
  if (!kind) return "1か所だけ違う組になっていません（声調は変調のあとで比べます）";
  const actual = familyOfPair(kind);
  if (actual !== family) return `この組は ${actual} の違いです（${family} ではありません）`;
  if (pairs.some((p) => (same(p.a, a) && same(p.b, b)) || (same(p.a, b) && same(p.b, a))))
    return "この組はもうあります";
  for (const s of [a, b]) {
    const known = meaningOf(text, s);
    if (!known && !s.ja.trim()) return `${s.hanzi} は初めての語なので、意味を書いてください`;
    if (known && s.ja.trim() && s.ja.trim() !== known)
      return `${s.hanzi} はほかの組で「${known}」です。意味を直すなら語の欄から`;
  }
  return null;
}

/** The pair added at the end of its difference (a new difference at the end of the file). */
export function addPair(text: string, family: string, a: Side, b: Side): string {
  const problem = checkNewPair(text, family, a, b);
  if (problem) throw new Error(problem);
  const line = `${write(a, !meaningOf(text, a))} | ${write(b, !meaningOf(text, b))}`;
  return rewrite(text, (lines) => {
    const start = lines.findIndex((l) => l.trim() === `## ${family}`);
    if (start < 0) {
      while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
      lines.push("", `## ${family}`, line, "");
      return;
    }
    let end = start + 1;
    while (end < lines.length && !lines[end].trim().startsWith("## ")) end++;
    let at = end;
    while (at > start + 1 && !lines[at - 1].trim()) at--;
    lines.splice(at, 0, line);
  });
}
