"use client";

// Playback through Web Audio: clips are fetched and decoded ahead (a rain's 40-odd small MP3s while its first screen
// is up), so a word plays the moment it is pressed, and one sound at a time. Every play() or stop() starts a new
// generation; anything still running from an older one (a sequence of clips, a pause) gives up and returns false.
//
// Browsers hold a context until a tap, and iOS holds it again after a call, the lock screen or the microphone
// ("suspended" or "interrupted"): every play wakes it, synchronously while still inside the tap that asked. After the
// microphone the next sound gets a new context (iOS, and Bluetooth headsets switching back from their call profile, can
// leave the old one quiet or silent); the decoded clips play in any context. On iOS the page also says its sound is
// playback, so it is heard with the ringer switch off, as an <audio> element (ことのあめ) is.

let ctx: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
let source: AudioBufferSourceNode | null = null;
let generation = 0;
let microphones = 0;

type SessionType = "playback" | "play-and-record";

/** Safari 17+ (navigator.audioSession): what kind of sound the page makes. Elsewhere there is nothing to set. */
function session(type: SessionType): void {
  const s = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (!s || s.type === type) return;
  try {
    s.type = type;
  } catch {
    // not settable here
  }
}

function context(): AudioContext {
  if (!ctx || ctx.state === "closed") ctx = new AudioContext();
  return ctx;
}

/** Asks a held context to run. Outside a tap iOS may leave the request pending: never wait on it for long. */
function wake(c: AudioContext): Promise<void> {
  if (c.state === "running") return Promise.resolve();
  const resumed = c.resume().catch(() => undefined);
  return Promise.race([resumed, new Promise<void>((r) => setTimeout(r, 800))]);
}

/** Call inside a tap: lets the page play sound from then on (and again after the browser has held it). */
export function unlock(): void {
  if (!microphones) session("playback");
  void wake(context());
}

/**
 * The microphone is about to open: playback stops, and on iOS the page asks for recording. The returned function, called
 * once it has closed, gives playback back with a new context for the next sound.
 */
export function holdForMicrophone(): () => void {
  stop();
  microphones++;
  session("play-and-record");
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--microphones > 0) return;
    session("playback");
    const old = ctx;
    ctx = null;
    void old?.close().catch(() => undefined);
  };
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
  await wake(c);
  if (gen !== generation) return false;
  silence();
  const node = c.createBufferSource();
  node.buffer = buffer;
  node.connect(c.destination);
  source = node;
  return new Promise((resolve) => {
    let settled = false;
    const end = (played: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      if (source === node) source = null;
      resolve(played && gen === generation);
    };
    // A context the browser keeps holding never ends the clip: give up rather than wait (the next tap wakes it), and
    // take the clip back so it does not start late over the next one.
    const guard = setTimeout(() => {
      try {
        node.stop();
      } catch {
        // never started
      }
      end(false);
    }, buffer.duration * 1000 + 1500);
    node.onended = () => end(true);
    node.start();
  });
}

const wait = (gen: number, ms: number) => new Promise<boolean>((r) => setTimeout(() => r(gen === generation), ms));

/** Plays one clip to its end. False if it could not be played or something newer took over. */
export function play(url: string): Promise<boolean> {
  unlock();
  return playIn(++generation, url);
}

/** Clips one after another, `gapMs` apart, each followed by `afterMs`. Stops early (false) when interrupted. */
export async function playInTurn(urls: string[], gapMs = 350, afterMs = 0): Promise<boolean> {
  unlock();
  const gen = ++generation;
  for (let i = 0; i < urls.length; i++) {
    if (i > 0 && !(await wait(gen, gapMs))) return false;
    if (!(await playIn(gen, urls[i]))) return false;
  }
  return afterMs ? wait(gen, afterMs) : gen === generation;
}
