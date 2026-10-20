import "server-only";
import OpenAI, { toFile } from "openai";
import { customPinyin, pinyin } from "pinyin-pro";
import readings from "@/lib/readings.json";

// What a learner's attempt sounds like: the one AI call the app makes while it is used (CONCEPT.md: AI は直すだけ).
// The recording is a 16 kHz WAV of one word (src/components/recorder.ts); it is passed on and not kept. The prompt
// only says it is one Mandarin word, never which, so the recognizer is not led to hear what was meant.
// No sign-in, so it is limited by size and length, per address and per instance of the server.

const MODEL = process.env.HEAR_MODEL || "gpt-4o-transcribe";
const MAX_BYTES = 44 + 16000 * 2 * 5; // 5 seconds
const PER_MINUTE = 20;
const PER_DAY = 300;
const ALL_PER_DAY = Number(process.env.HEAR_PER_DAY) || 3000;

const byAddress = new Map<string, { minute: number; minuteCount: number; day: string; dayCount: number }>();
let all = { day: "", count: 0 };

function allowed(address: string): boolean {
  const now = Date.now();
  const minute = Math.floor(now / 60_000);
  const day = new Date(now).toISOString().slice(0, 10);
  if (all.day !== day) all = { day, count: 0 };
  if (all.count >= ALL_PER_DAY) return false;
  const r = byAddress.get(address) ?? { minute, minuteCount: 0, day, dayCount: 0 };
  if (r.minute !== minute) Object.assign(r, { minute, minuteCount: 0 });
  if (r.day !== day) Object.assign(r, { day, dayCount: 0 });
  if (r.minuteCount >= PER_MINUTE || r.dayCount >= PER_DAY) return false;
  r.minuteCount++;
  r.dayCount++;
  all.count++;
  byAddress.set(address, r);
  if (byAddress.size > 5000) byAddress.clear();
  return true;
}

function isWav16k(b: Uint8Array): boolean {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const tag = (o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
  return (
    b.byteLength > 44 &&
    tag(0) === "RIFF" &&
    tag(8) === "WAVE" &&
    view.getUint16(20, true) === 1 &&
    view.getUint16(22, true) === 1 &&
    view.getUint32(24, true) === 16000 &&
    view.getUint16(34, true) === 16
  );
}

// Word readings pinyin-pro gets wrong (朋友 péng you, 店长 diàn zhǎng …, borrowed from ことのあめ) and this app's own
// words (scripts/build-data.mjs writes the file).
customPinyin(readings);

let client: OpenAI | null = null;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "unavailable" }, { status: 503 });
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength > MAX_BYTES || !isWav16k(body)) return Response.json({ error: "bad audio" }, { status: 400 });
  if (!allowed(address)) return Response.json({ error: "too many" }, { status: 429 });

  try {
    client ??= new OpenAI();
    const r = await client.audio.transcriptions.create({
      file: await toFile(body, "attempt.wav", { type: "audio/wav" }),
      model: MODEL,
      language: "zh",
      prompt: "以下是一个普通话词语。",
    });
    const text = r.text.replace(/[^\p{Script=Han}]/gu, "");
    const reading = text ? pinyin(text, { toneType: "symbol", type: "array" }).join(" ") : "";
    return Response.json({ text, pinyin: reading });
  } catch {
    return Response.json({ error: "failed" }, { status: 502 });
  }
}
