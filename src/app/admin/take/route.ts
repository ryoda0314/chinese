import { existsSync, readFileSync } from "node:fs";
import { notFound } from "next/navigation";
import { rawTake } from "@/lib/admin";
import { floatToWav, readWav, tidy } from "../../../../scripts/lib/wav.mjs";

// One raw take, trimmed and levelled as the app would play it, for a person to listen to (/admin/audio).
// Development only: the takes are on this machine, not in the deployed app.
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") notFound();
  const q = new URL(request.url).searchParams;
  const voice = q.get("voice") ?? "";
  const id = q.get("id") ?? "";
  const take = q.get("take") ?? "";
  if (!/^[a-z]+$/.test(voice) || !/^[a-z0-9]+-[0-9a-f]{4}$/.test(id) || !/^\d$/.test(take)) {
    return new Response("bad request", { status: 400 });
  }
  const file = rawTake(voice, id, Number(take));
  if (!existsSync(file)) return new Response("not found", { status: 404 });
  const { rate, samples } = readWav(readFileSync(file));
  const wav: Buffer = floatToWav(tidy(samples, rate), rate);
  return new Response(new Uint8Array(wav), { headers: { "content-type": "audio/wav", "cache-control": "no-store" } });
}
