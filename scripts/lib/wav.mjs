// WAV in and out, and the cleanup every clip gets before it is checked or encoded: the silence Gemini leaves before the
// word is cut (it reads as "I pressed and nothing happened"), the tail is cut short but faded, not chopped, and the
// loudness is brought to one level so the four voices sound equally near.

export function pcm16ToWav(pcm, rate) {
  const buf = Buffer.alloc(44 + pcm.length);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + pcm.length, 4);
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
  buf.writeUInt32LE(pcm.length, 40);
  pcm.copy(buf, 44);
  return buf;
}

/** 16-bit mono PCM WAV → samples in -1..1. Finds the data chunk rather than assuming it starts at byte 44. */
export function readWav(buf) {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") throw new Error("not a WAV");
  let rate = 24000;
  let channels = 1;
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "fmt ") {
      channels = buf.readUInt16LE(offset + 10);
      rate = buf.readUInt32LE(offset + 12);
      if (buf.readUInt16LE(offset + 22) !== 16) throw new Error("not 16-bit");
    }
    if (id === "data") {
      const frames = Math.floor(Math.min(size, buf.length - offset - 8) / (2 * channels));
      const samples = new Float32Array(frames);
      for (let i = 0; i < frames; i++) samples[i] = buf.readInt16LE(offset + 8 + i * 2 * channels) / 32768;
      return { rate, samples };
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error("no data chunk");
}

export function floatToWav(samples, rate) {
  const pcm = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    pcm.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  return pcm16ToWav(pcm, rate);
}

const FLOOR = 0.006; // 0.6% of full scale
const LEAD = 0.02; // keep 20 ms before the first sound, or the word's first consonant is clipped
const TAIL = 0.12; // keep 120 ms after the last sound
const FADE = 0.04;
const AFTER = 0.08; // then this much silence
const TARGET_RMS = 0.1; // about -20 dBFS over the loud part
const PEAK = 0.89;

/** Trimmed, faded and levelled samples. */
export function tidy(samples, rate) {
  let first = 0;
  while (first < samples.length && Math.abs(samples[first]) < FLOOR) first++;
  let last = samples.length - 1;
  while (last > first && Math.abs(samples[last]) < FLOOR) last--;
  const start = Math.max(0, first - Math.round(LEAD * rate));
  const end = Math.min(samples.length, last + Math.round(TAIL * rate));
  const body = samples.slice(start, end);

  // Level by the loud part (frames above a tenth of the peak frame), so a long quiet tail does not lift the word.
  const win = Math.round(0.02 * rate);
  const frameRms = [];
  for (let i = 0; i + win <= body.length; i += win) {
    let s = 0;
    for (let k = i; k < i + win; k++) s += body[k] * body[k];
    frameRms.push(Math.sqrt(s / win));
  }
  const top = Math.max(...frameRms, 1e-6);
  const loud = frameRms.filter((r) => r > top * 0.1);
  const rms = Math.sqrt(loud.reduce((a, r) => a + r * r, 0) / Math.max(1, loud.length));
  let peak = 0;
  for (const v of body) peak = Math.max(peak, Math.abs(v));
  const gain = Math.min(TARGET_RMS / Math.max(rms, 1e-6), PEAK / Math.max(peak, 1e-6));

  const fade = Math.round(FADE * rate);
  const out = new Float32Array(body.length + Math.round(AFTER * rate));
  for (let i = 0; i < body.length; i++) {
    const fromEnd = body.length - 1 - i;
    out[i] = body[i] * gain * (fromEnd < fade ? fromEnd / fade : 1);
  }
  return out;
}
