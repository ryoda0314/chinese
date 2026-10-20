import "server-only";
import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";

// The maker's side (/admin): the content lives in this repository (data/, public/audio, public/data) and the raw takes
// in scripts/work/raw on the machine that made them, so the admin pages run only under `npm run dev` on that machine
// and are not there at all anywhere else.

export function assertDev(): void {
  if (process.env.NODE_ENV !== "development") notFound();
}

const ROOT = process.cwd();
// Never traced into a build: these files are read only under `npm run dev` (assertDev), on the machine that has them.
const at = (p: string) => path.join(/*turbopackIgnore: true*/ ROOT, p);

export function readJson<T>(p: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(at(p), "utf8")) as T;
  } catch {
    return fallback;
  }
}
export const writeJson = (p: string, value: unknown) => writeFileSync(at(p), JSON.stringify(value, null, 1) + "\n");
export const readText = (p: string) => readFileSync(at(p), "utf8");
export const writeText = (p: string, text: string) => writeFileSync(at(p), text);
export const modifiedAt = (p: string) => (existsSync(at(p)) ? statSync(at(p)).mtimeMs : 0);

export type AdminWord = { id: string; hanzi: string; pinyin: string; ja: string };
export type ReviewItem = { voice: string; id: string; hanzi: string; pinyin: string; why: string };
export type Clip = { status: "pass" | "retry" | "review"; attempt: number; tries: number; why: string };
export type Clips = { voices: { id: string; name: string; sex: string }[]; clips: Record<string, Clip> };

/** The takes on disk for one word in one voice (0, 1, 2 …). */
export function takesOf(voice: string, id: string): number[] {
  const dir = at(`scripts/work/raw/${voice}`);
  if (!existsSync(dir)) return [];
  const re = new RegExp(`^${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.(\\d+)\\.wav$`);
  return readdirSync(dir)
    .flatMap((f) => {
      const m = f.match(re);
      return m ? [Number(m[1])] : [];
    })
    .sort((a, b) => a - b);
}

export const rawTake = (voice: string, id: string, take: number) => at(`scripts/work/raw/${voice}/${id}.${take}.wav`);

// ------------------------------------------------------------------ jobs

export type JobKind = "apply" | "rebuild" | "audio" | "sentences";
type Step = { label: string; args: string[] };

const node = (...args: string[]) => args;
export const JOBS: Record<JobKind, { label: string; note: string; steps: Step[] }> = {
  apply: {
    label: "音声の合否を反映",
    note: "使うと決めた take を合格にし、MP3 とアプリのデータを作り直す（数分）",
    steps: [
      { label: "検査をやり直す", args: node("--env-file=.env.local", "scripts/generate-audio.mjs", "--no-generate") },
      { label: "MP3 に書き出す", args: node("scripts/publish-audio.mjs") },
      { label: "アプリのデータを作る", args: node("scripts/build-data.mjs") },
    ],
  },
  rebuild: {
    label: "語の組を反映",
    note: "pairs.txt を検査して、アプリのデータを作り直す。新しい語は音声ができるまでアプリに出ない",
    steps: [
      { label: "pairs.txt を検査する", args: node("scripts/check-data.mjs") },
      { label: "アプリのデータを作る", args: node("scripts/build-data.mjs") },
    ],
  },
  audio: {
    label: "足りない音声を作る",
    note: "新しい語を4つの声で作って検査し、書き出す（Gemini TTS。1分に10本ほど）",
    steps: [
      { label: "pairs.txt を検査する", args: node("scripts/check-data.mjs") },
      { label: "作って検査する", args: node("--env-file=.env.local", "scripts/generate-audio.mjs") },
      { label: "MP3 に書き出す", args: node("scripts/publish-audio.mjs") },
      { label: "アプリのデータを作る", args: node("scripts/build-data.mjs") },
    ],
  },
  sentences: {
    label: "ことのあめの例文を取り直す",
    note: "ことのあめの承認済みの文から、同じ読みで出てくる短い文を取り直す",
    steps: [
      { label: "例文を取る", args: node("--env-file=../../polylinga/.env.local", "scripts/export-sentences.mjs") },
      { label: "アプリのデータを作る", args: node("scripts/build-data.mjs") },
    ],
  },
};

export type Job = {
  kind: JobKind;
  status: "running" | "done" | "failed";
  step: string;
  startedAt: number;
  endedAt?: number;
  log: string[];
};

// Kept on globalThis so a reload of this module in development does not lose a running job.
const holder = globalThis as unknown as { __kotononeJob?: Job };
const LOG_LINES = 400;

export const currentJob = (): Job | null => holder.__kotononeJob ?? null;

/** Starts a job unless one is running; its steps run one after another, stopping at the first that fails. */
export function startJob(kind: JobKind): boolean {
  if (holder.__kotononeJob?.status === "running") return false;
  const job: Job = { kind, status: "running", step: "", startedAt: Date.now(), log: [] };
  holder.__kotononeJob = job;
  const say = (text: string) => {
    for (const line of text.split(/\r?\n/))
      if (line.trim() && !/credentials will take precedence/.test(line)) job.log.push(line);
    if (job.log.length > LOG_LINES) job.log.splice(0, job.log.length - LOG_LINES);
  };
  void (async () => {
    for (const step of JOBS[kind].steps) {
      job.step = step.label;
      say(`── ${step.label}`);
      const code = await new Promise<number>((resolve) => {
        const child = spawn(process.execPath, step.args, { cwd: ROOT, env: process.env });
        child.stdout.on("data", (d: Buffer) => say(d.toString("utf8")));
        child.stderr.on("data", (d: Buffer) => say(d.toString("utf8")));
        child.on("error", (e) => {
          say(String(e));
          resolve(1);
        });
        child.on("close", (c) => resolve(c ?? 1));
      });
      if (code !== 0) {
        say(`── 止まりました（${step.label}）`);
        job.status = "failed";
        job.endedAt = Date.now();
        return;
      }
    }
    say("── 終わりました");
    job.status = "done";
    job.endedAt = Date.now();
  })();
  return true;
}
