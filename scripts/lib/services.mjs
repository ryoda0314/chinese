// Gemini TTS on Vertex AI (the same project and service account as ことのあめ) and OpenAI speech-to-text.
import { GoogleGenAI } from "@google/genai";
import OpenAI, { toFile } from "openai";
import { pcm16ToWav } from "./wav.mjs";

export const TTS_MODELS = { flash: "gemini-2.5-flash-preview-tts", pro: "gemini-2.5-pro-preview-tts" };

let gemini = null;
function vertex() {
  if (gemini) return gemini;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  let credentials;
  try {
    credentials = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
  } catch {
    credentials = JSON.parse(raw.replace(/\\n/g, "\n"));
  }
  gemini = new GoogleGenAI({
    vertexai: true,
    project: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
    googleAuthOptions: { credentials },
  });
  return gemini;
}

/** One generation as a WAV buffer (Gemini returns raw 16-bit PCM; the rate is read from its mime type). */
export async function synthesize(prompt, voice, model = TTS_MODELS.flash) {
  const r = await vertex().models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: { languageCode: "zh-CN", voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
    },
  });
  const part = r.candidates?.[0]?.content?.parts?.find((x) => x.inlineData?.data);
  if (!part) throw new Error("no audio");
  const mime = part.inlineData.mimeType ?? "";
  const bytes = Buffer.from(part.inlineData.data, "base64");
  if (!/pcm|l16/i.test(mime)) throw new Error(`unexpected audio type ${mime}`);
  const rate = Number(mime.match(/rate=(\d+)/i)?.[1]) || 24000;
  return pcm16ToWav(bytes, rate);
}

let openai = null;
/**
 * What a speech recognizer hears in a WAV, as text. By default the prompt only says it is one Mandarin word, never
 * which. With `choices` it says it is one of these words: a recognizer otherwise leans toward the commoner word of a
 * pair (陈旧 heard as 成就), and naming both takes that lean away. Used only to check generated clips.
 */
export async function transcribe(wav, model = "gpt-4o-transcribe", choices = null) {
  openai ??= new OpenAI();
  const prompt = choices ? `以下是一个普通话词语，是「${choices[0]}」或者「${choices[1]}」。` : "以下是一个普通话词语。";
  const r = await openai.audio.transcriptions.create({
    file: await toFile(wav, "clip.wav", { type: "audio/wav" }),
    model,
    language: "zh",
    prompt,
  });
  return r.text.trim();
}

/** Retries rate limits (Vertex TTS quota is per minute) and dropped connections; anything else is thrown. */
export async function withRetry(fn, { rateWaitMs = 10_000, offlineWaitMs = 30_000 } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = String(err?.message ?? err);
      if (/RESOURCE_EXHAUSTED|429/.test(msg) && attempt < 40) {
        await new Promise((r) => setTimeout(r, rateWaitMs));
        continue;
      }
      if (/fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|503|UNAVAILABLE/i.test(msg) && attempt < 20) {
        await new Promise((r) => setTimeout(r, offlineWaitMs));
        continue;
      }
      throw err;
    }
  }
}
