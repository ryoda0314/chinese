// The shape of the public data the app fetches (public/data, built by scripts/build-data.mjs).
import type { FamilyId } from "./i18n/ja.ts";

export type Line = (number | null)[];

export type VoiceInfo = {
  id: string;
  sex: "f" | "m";
  /** Its levels: semitones above 100 Hz at level 1 and level 5. */
  lo: number;
  hi: number;
};

export type WordData = {
  id: string;
  hanzi: string;
  pinyin: string;
  ja: string;
  /** The pitch line of each voice that has a checked clip of this word (its audio: /audio/<voice>/<id>.mp3). */
  lines: Record<string, Line>;
  /** Words whose vowel is u or ü itself: each voice's frontness in dB (src/lib/vowel.ts). */
  front?: Record<string, number>;
};

export type PairData = { a: string; b: string; at: number[] };

export type Sentence = {
  zh: string;
  /** One syllable per Han character. */
  pinyin: string;
  ja: string;
  audio: string;
  /** Which Han character (counting Han characters only) the word starts at. */
  at: number;
};

export type FamilyData = {
  id: FamilyId;
  pairs: PairData[];
  words: Record<string, WordData>;
  /** Sentences from ことのあめ, by word id. */
  sentences: Record<string, Sentence[]>;
};

export type Index = {
  version: string;
  voices: VoiceInfo[];
  families: { id: FamilyId; pairs: number }[];
};

export const audioUrl = (voice: string, wordId: string) => `/audio/${voice}/${wordId}.mp3`;
