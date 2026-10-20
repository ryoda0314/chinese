"use server";

import { refresh } from "next/cache";
import { assertDev, readJson, readText, startJob, writeJson, writeText, type JobKind } from "@/lib/admin";
import { addPair, removePair, setMeaning, type Side } from "@/lib/pairs-file";

// What the admin pages change: which takes a person approved or set aside, and data/pairs.txt. Every change is a file
// in this repository; the jobs (lib/admin.ts) carry it into the app.

const APPROVED = "data/approved.json";
const DISMISSED = "data/dismissed.json";
const PAIRS = "data/pairs.txt";

const VOICE = /^[a-z]+$/;
const WORD = /^[a-z0-9]+-[0-9a-f]{4}$/;
function checkClip(voice: string, id: string) {
  if (!VOICE.test(voice) || !WORD.test(id)) throw new Error("bad clip");
}

/** This take is right: it counts as passing from the next 音声の合否を反映. */
export async function approveTake(voice: string, id: string, take: number) {
  assertDev();
  checkClip(voice, id);
  const list = readJson<string[]>(APPROVED, []).filter((k) => !k.startsWith(`${voice}/${id}.`));
  writeJson(APPROVED, [...list, `${voice}/${id}.${take}`].sort());
  writeJson(
    DISMISSED,
    readJson<string[]>(DISMISSED, []).filter((k) => k !== `${voice}/${id}`),
  );
  refresh();
}

export async function unapprove(voice: string, id: string) {
  assertDev();
  checkClip(voice, id);
  writeJson(
    APPROVED,
    readJson<string[]>(APPROVED, []).filter((k) => !k.startsWith(`${voice}/${id}.`)),
  );
  refresh();
}

/** None of the takes will do: the word goes without this voice (it is no longer listed). */
export async function dismissClip(voice: string, id: string) {
  assertDev();
  checkClip(voice, id);
  const list = readJson<string[]>(DISMISSED, []).filter((k) => k !== `${voice}/${id}`);
  writeJson(DISMISSED, [...list, `${voice}/${id}`].sort());
  refresh();
}

export async function undismiss(voice: string, id: string) {
  assertDev();
  checkClip(voice, id);
  writeJson(
    DISMISSED,
    readJson<string[]>(DISMISSED, []).filter((k) => k !== `${voice}/${id}`),
  );
  refresh();
}

export async function removePairAction(a: Omit<Side, "ja">, b: Omit<Side, "ja">) {
  assertDev();
  writeText(PAIRS, removePair(readText(PAIRS), a, b));
  refresh();
}

export type FormResult = { ok: boolean; message: string };

export async function setMeaningAction(_: FormResult | null, form: FormData): Promise<FormResult> {
  assertDev();
  const [hanzi, pinyin] = String(form.get("word") ?? "").split("|");
  try {
    writeText(PAIRS, setMeaning(readText(PAIRS), { hanzi, pinyin }, String(form.get("ja") ?? "")));
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
  refresh();
  return { ok: true, message: `${hanzi} の意味を直しました。「語の組を反映」で アプリに入ります。` };
}

export async function addPairAction(_: FormResult | null, form: FormData): Promise<FormResult> {
  assertDev();
  const side = (k: "a" | "b"): Side => ({
    hanzi: String(form.get(`${k}Hanzi`) ?? "").trim(),
    pinyin: String(form.get(`${k}Pinyin`) ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .normalize("NFC"),
    ja: String(form.get(`${k}Ja`) ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/\|/g, "／"),
  });
  const family = String(form.get("family") ?? "");
  const a = side("a");
  const b = side("b");
  try {
    writeText(PAIRS, addPair(readText(PAIRS), family, a, b));
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
  refresh();
  return {
    ok: true,
    message: `${a.hanzi}／${b.hanzi} を ${family} に足しました。「足りない音声を作る」で音声ができるとアプリに出ます。`,
  };
}

export async function runJob(kind: JobKind): Promise<boolean> {
  assertDev();
  return startJob(kind);
}
