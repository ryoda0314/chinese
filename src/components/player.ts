"use client";

// Playback through Web Audio: clips are fetched and decoded ahead (a rain's 40-odd small MP3s while its first screen
// is up), so a word plays the moment it is pressed, and one sound at a time. Every play() or stop() starts a new
// generation; anything still running from an older one (a sequence of clips, a pause) gives up and returns false.
// Mobile browsers start audio only inside a tap, so unlock() is called from the first one.

let ctx: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
let source: AudioBufferSourceNode | null = null;
let generation = 0;

function context(): AudioContext {
  ctx ??= new AudioContext();
  return ctx;
}

/** Call inside a tap: lets the page play sound from then on. */
export function unlock(): void {
  const c = context();
  if (c.state === "suspended") void c.resume();
}

function load(url: string): Promise<AudioBuffer | null> {
  let p = buffers.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((b) => context().decodeAudioData(b))
      .catch(() => {
        buffers.delete(url); // try again next time
        return null;
      });
    buffers.set(url, p);
  }
  return p;
}

export function preload(urls: string[]): Promise<unknown> {
  return Promise.all(urls.map(load));
}

function silence(): void {
  if (!source) return;
  try {
    source.stop();
  } catch {
    // already ended
  }
  source = null;
}

export function stop(): void {
  generation++;
  silence();
}

async function playIn(gen: number, url: string): Promise<boolean> {
  const buffer = await load(url);
  if (!buffer || gen !== generation) return false;
  const c = context();
  if (c.state === "suspended") await c.resume().catch(() => undefined);
  silence();
  const node = c.createBufferSource();
  node.buffer = buffer;
  node.connect(c.destination);
  source = node;
  return new Promise((resolve) => {
    node.onended = () => {
      if (source === node) source = null;
      resolve(gen === generation);
    };
    node.start();
  });
}

const wait = (gen: number, ms: number) => new Promise<boolean>((r) => setTimeout(() => r(gen === generation), ms));

/** Plays one clip to its end. False if it could not be played or something newer took over. */
export function play(url: string): Promise<boolean> {
  return playIn(++generation, url);
}

/** Clips one after another, `gapMs` apart, each followed by `afterMs`. Stops early (false) when interrupted. */
export async function playInTurn(urls: string[], gapMs = 350, afterMs = 0): Promise<boolean> {
  const gen = ++generation;
  for (let i = 0; i < urls.length; i++) {
    if (i > 0 && !(await wait(gen, gapMs))) return false;
    if (!(await playIn(gen, urls[i]))) return false;
  }
  return afterMs ? wait(gen, afterMs) : gen === generation;
}
