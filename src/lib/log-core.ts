/**
 * What the learner did, kept for looking back (自分): each rain (when, which difference, which pairs mixed up) and each
 * word they said (the line their voice drew, which word it was nearer, what it was heard as). The recordings themselves
 * are never kept, only the lines. Part of the record (State.log), so it travels with the account and is merged the same
 * way. Bounded: the newest rains, and for each word its first line and its latest ones. Pure.
 */
import type { Line } from "./data.ts";
import type { FamilyId } from "./i18n/ja.ts";

export const RAINS_KEPT = 400;
export const SAID_KEPT = 200;
export const SAID_PER_WORD = 6;
/** Days are the learner's days in Japan. */
const JST = 9 * 60 * 60 * 1000;

export type RainLog = { at: number; family: FamilyId; pairs: string[]; missed: string[] };
export type Verdict = "word" | "partner" | null;
export type SaidLog = {
  at: number;
  word: string;
  partner: string;
  family: FamilyId;
  line: Line;
  /** Which word the line was nearer (tone pairs). */
  nearer?: Verdict;
  /** Which word the vowel was nearer (u/ü pairs). */
  vowel?: Verdict;
  /** What the recognizer heard, when it was asked. */
  heard?: string;
};
export type Log = { rains: RainLog[]; said: SaidLog[] };

export const emptyLog = (): Log => ({ rains: [], said: [] });

export function dayOf(ms: number): string {
  return new Date(ms + JST).toISOString().slice(0, 10);
}

/** A line kept small: one decimal. */
export function compactLine(line: Line): Line {
  return line.map((v) => (v === null ? null : Math.round(v * 10) / 10));
}

const byTime = <T extends { at: number }>(a: T, b: T) => a.at - b.at;

/** Rains: the newest RAINS_KEPT. Said: per word its first line and its latest ones, then the newest SAID_KEPT overall. */
function trim(log: Log): Log {
  const rains = [...log.rains].sort(byTime).slice(-RAINS_KEPT);
  const perWord = new Map<string, SaidLog[]>();
  for (const s of [...log.said].sort(byTime)) perWord.set(s.word, [...(perWord.get(s.word) ?? []), s]);
  let said: SaidLog[] = [];
  for (const list of perWord.values()) {
    said.push(...(list.length > SAID_PER_WORD ? [list[0], ...list.slice(-(SAID_PER_WORD - 1))] : list));
  }
  said.sort(byTime);
  if (said.length > SAID_KEPT) {
    // Over the limit: the oldest go, but never a word's first line while there is something else to let go.
    const firsts = new Set([...perWord.values()].map((l) => l[0]));
    const extra = said.length - SAID_KEPT;
    const goable = said.filter((s) => !firsts.has(s)).slice(0, extra);
    const gone = new Set(goable.length >= extra ? goable : said.slice(0, extra));
    said = said.filter((s) => !gone.has(s));
  }
  return { rains, said };
}

export function logRain(log: Log | undefined, entry: RainLog): Log {
  const base = log ?? emptyLog();
  return trim({ ...base, rains: [...base.rains, entry] });
}

export function logSaid(log: Log | undefined, entry: SaidLog): Log {
  const base = log ?? emptyLog();
  return trim({ ...base, said: [...base.said, { ...entry, line: compactLine(entry.line) }] });
}

/** What the recognizer heard arrives after the line: added to the attempt made at `at`. */
export function setHeard(log: Log | undefined, at: number, heard: string): Log {
  const base = log ?? emptyLog();
  return { ...base, said: base.said.map((s) => (s.at === at ? { ...s, heard } : s)) };
}

/** Lets go of the lines of one word, or of every word. */
export function forgetSaid(log: Log | undefined, word?: string): Log {
  const base = log ?? emptyLog();
  return { ...base, said: word ? base.said.filter((s) => s.word !== word) : [] };
}

/** Two logs of one learner made one: each entry once (by its time and what it was about). */
export function mergeLogs(a: Log | undefined, b: Log | undefined): Log {
  const key = (e: RainLog | SaidLog) => `${e.at}:${"family" in e && !("word" in e) ? e.family : (e as SaidLog).word}`;
  const unique = <T extends RainLog | SaidLog>(list: T[]) => [...new Map(list.map((e) => [key(e), e])).values()];
  return trim({
    rains: unique([...(a?.rains ?? []), ...(b?.rains ?? [])]),
    said: unique([...(a?.said ?? []), ...(b?.said ?? [])]),
  });
}

export type DayView = {
  day: string;
  /** The differences that fell that day, in order, with how many rains of each and the pairs mixed up. */
  rains: { family: FamilyId; times: number; missed: string[] }[];
  /** The words said that day (each once). */
  said: string[];
};

/** Days with something in them, newest first. */
export function daysOf(log: Log | undefined): DayView[] {
  const days = new Map<string, DayView>();
  const get = (day: string) => days.get(day) ?? days.set(day, { day, rains: [], said: [] }).get(day)!;
  for (const r of [...(log?.rains ?? [])].sort(byTime)) {
    const d = get(dayOf(r.at));
    const same = d.rains.find((x) => x.family === r.family);
    if (same) {
      same.times++;
      same.missed = [...new Set([...same.missed, ...r.missed])];
    } else d.rains.push({ family: r.family, times: 1, missed: [...r.missed] });
  }
  for (const s of [...(log?.said ?? [])].sort(byTime)) {
    const d = get(dayOf(s.at));
    if (!d.said.includes(s.word)) d.said.push(s.word);
  }
  return [...days.values()].sort((x, y) => (x.day < y.day ? 1 : -1));
}

/** Each word said, its attempts oldest first, the words most recently said first. */
export function saidByWord(log: Log | undefined): { word: string; attempts: SaidLog[] }[] {
  const map = new Map<string, SaidLog[]>();
  for (const s of [...(log?.said ?? [])].sort(byTime)) map.set(s.word, [...(map.get(s.word) ?? []), s]);
  return [...map.entries()]
    .map(([word, attempts]) => ({ word, attempts }))
    .sort((a, b) => b.attempts[b.attempts.length - 1].at - a.attempts[a.attempts.length - 1].at);
}

/** The days a difference fell, newest first. */
export function daysOfFamily(log: Log | undefined, family: FamilyId): string[] {
  return [...new Set((log?.rains ?? []).filter((r) => r.family === family).map((r) => dayOf(r.at)))].sort().reverse();
}
