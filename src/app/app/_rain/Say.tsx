"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { PitchLines } from "@/components/PitchLines";
import { play, stop, unlock } from "@/components/player";
import { record, toWav16k, type RecordError } from "@/components/recorder";
import { audioUrl, type FamilyData, type Line, type PairData, type VoiceInfo, type WordData } from "@/lib/data";
import { ja } from "@/lib/i18n/ja";
import {
  centerEstimate,
  learnerCenter,
  learnerLevels,
  learnerPitchRange,
  nearer,
  nearestVoice,
  remember,
  spanOf,
} from "@/lib/learner";
import { trackPitch } from "@/lib/pitch";
import type { State } from "@/lib/rain-core";
import type { FamilyId } from "@/lib/i18n/ja";
import { logSaid, setHeard, type SaidLog, type Verdict } from "@/lib/log-core";
import { lineOf } from "@/lib/tone";
import { frontness } from "@/lib/vowel";
import { WordFace } from "./WordFace";
import styles from "./rain.module.css";

const WORDS = 2;
// Nearer one vowel than the other by less than this (dB of frontness): neither.
const VOWEL_UNDECIDED_DB = 3;

type Heard = { text: string; pinyin: string } | "none" | "unavailable" | "pending";
type Attempt =
  | { kind: "idle" }
  | { kind: "listening"; level: number }
  | { kind: "analysing" }
  | {
      kind: "done";
      line: Line;
      voice: string;
      nearer: "word" | "partner" | null;
      /** u/ü words: which word the vowel is nearer, from its sound (the recognizer swaps u and ü). */
      vowel?: "word" | "partner" | null;
      heard: Heard;
    }
  | { kind: "problem"; message: string };

/** The words to say: one from each pair mixed up in this rain first, then from the others. */
function wordsToSay(pairs: PairData[], missed: PairData[]): { word: string; partner: string }[] {
  const order = [...missed, ...pairs.filter((p) => !missed.includes(p))];
  return order.slice(0, WORDS).map((p, i) => (i % 2 === 0 ? { word: p.a, partner: p.b } : { word: p.b, partner: p.a }));
}

/** 言ってみる: say a word; its pitch line is laid over the model's, and a recognizer says what it heard. */
export function Say({
  family,
  pairs,
  missed,
  voices,
  getState,
  update,
}: {
  family: FamilyData;
  pairs: PairData[];
  missed: PairData[];
  voices: VoiceInfo[];
  getState: () => State;
  update: (s: State) => void;
}) {
  const [items] = useState(() => wordsToSay(pairs, missed));
  useEffect(() => () => stop(), []);
  return (
    <>
      <p className={styles.lead}>{ja.rain.sayLead}</p>
      <ul className={styles.sayList}>
        {items.map(({ word, partner }) => (
          <SayCard
            key={word}
            word={family.words[word]}
            partner={family.words[partner]}
            family={family.id}
            voices={voices}
            getState={getState}
            update={update}
          />
        ))}
      </ul>
    </>
  );
}

/** One word to say: the model, a recording, its line over the model's, and what it sounded like. Kept in the log. */
export function SayCard({
  word,
  partner,
  family,
  voices,
  getState,
  update,
}: {
  word: WordData;
  partner: WordData;
  family: FamilyId;
  voices: VoiceInfo[];
  getState: () => State;
  update: (s: State) => void;
}) {
  const [attempt, setAttempt] = useState<Attempt>({ kind: "idle" });
  const [playing, setPlaying] = useState(false);
  const turn = useRef(0);
  const center = learnerCenter(getState().voice);
  const model = nearestVoice(voices, center, Object.keys(word.lines));
  const vowelPair = Boolean(word.front && partner.front);

  /** Which word a vowel's frontness is nearer, in the model voice nearest the learner that has both. */
  function vowelNearer(f: number | null, mid: number): "word" | "partner" | null {
    if (f === null || !word.front || !partner.front) return null;
    const both = Object.keys(word.front).filter((v) => partner.front?.[v] !== undefined);
    const v = nearestVoice(voices, mid, both);
    const dw = Math.abs(f - word.front[v]);
    const dp = Math.abs(f - (partner.front[v] as number));
    if (Math.abs(dw - dp) < VOWEL_UNDECIDED_DB) return null;
    return dw < dp ? "word" : "partner";
  }

  async function hearModel() {
    unlock();
    const available = Object.keys(word.lines);
    // The voice nearest the learner first, then the others in turn.
    const order = [model, ...available.filter((v) => v !== model)];
    const voice = order[turn.current++ % order.length];
    setPlaying(true);
    await play(audioUrl(voice, word.id));
    setPlaying(false);
  }

  async function say() {
    unlock();
    stop();
    setAttempt({ kind: "listening", level: 0 });
    let rec;
    try {
      rec = await record((level) => setAttempt({ kind: "listening", level }));
    } catch (err) {
      const e = err as RecordError;
      setAttempt({
        kind: "problem",
        message: e === "denied" ? ja.rain.micDenied : e === "missing" ? ja.rain.micMissing : ja.rain.noVoice,
      });
      return;
    }
    setAttempt({ kind: "analysing" });

    const s = getState();
    const frames = trackPitch(rec.samples, rec.rate, learnerPitchRange(s.voice));
    const span = spanOf(voices);
    const estimate = centerEstimate(frames, word, span);
    if (estimate === null) {
      setAttempt({ kind: "problem", message: ja.rain.noVoice });
      return;
    }
    const estimates = remember(s.voice, estimate);
    const mid = learnerCenter(estimates) as number;
    const line = lineOf(frames, learnerLevels(mid, span));
    const verdict = nearer(line, word, partner).nearer;
    const voice = nearestVoice(voices, mid, Object.keys(word.lines));
    const vowel = vowelPair ? vowelNearer(frontness(rec.samples, rec.rate, frames, "middle"), mid) : undefined;
    const at = Date.now();
    const toWord: Verdict = verdict === "a" ? "word" : verdict === "b" ? "partner" : null;
    // The line is kept for looking back (自分); the recording is not.
    const said: SaidLog = {
      at,
      word: word.id,
      partner: partner.id,
      family,
      line,
      ...(byTone ? { nearer: toWord } : {}),
      ...(vowel !== undefined ? { vowel } : {}),
    };
    update({ ...s, voice: estimates, log: logSaid(s.log, said) });
    setAttempt({
      kind: "done",
      line,
      voice,
      nearer: verdict === "a" ? "word" : verdict === "b" ? "partner" : null,
      vowel,
      heard: vowelPair ? "unavailable" : "pending",
    });
    // u and ü: the recognizer is not asked (it swaps them); the vowel's sound has answered.
    if (vowelPair) return;

    let heard: Heard = "unavailable";
    try {
      const r = await fetch("/api/hear", {
        method: "POST",
        body: toWav16k(rec),
        headers: { "content-type": "audio/wav" },
      });
      if (r.ok) {
        const body = (await r.json()) as { text: string; pinyin: string };
        // The word or its partner: their own checked pinyin rather than the recognizer's guess at it.
        const known = [word, partner].find((w) => w.hanzi === body.text);
        heard = body.text ? { text: body.text, pinyin: known?.pinyin ?? body.pinyin } : "none";
      }
    } catch {
      // stays unavailable
    }
    setAttempt((a) => (a.kind === "done" ? { ...a, heard } : a));
    if (typeof heard === "object") {
      const now = getState();
      update({ ...now, log: setHeard(now.log, at, heard.text) });
    }
  }

  const busy = attempt.kind === "listening" || attempt.kind === "analysing";
  const byTone = family.startsWith("t");

  return (
    <li className={styles.sayCard}>
      <div className={styles.sayWord}>
        <WordFace word={word} />
      </div>
      <div className={styles.sayButtons}>
        <button
          type="button"
          className="btn-quiet"
          onClick={hearModel}
          disabled={busy}
          data-playing={playing ? "" : undefined}
        >
          <Icon name="speaker" />
          {ja.rain.modelLine}
        </button>
        <button
          type="button"
          className={`btn ${styles.record}`}
          onClick={say}
          disabled={busy}
          data-on={attempt.kind === "listening" ? "" : undefined}
          style={
            attempt.kind === "listening"
              ? ({ "--level": 0.25 + attempt.level * 0.75 } as React.CSSProperties)
              : undefined
          }
        >
          <Icon name="mic" />
          {attempt.kind === "listening"
            ? ja.rain.recording
            : attempt.kind === "analysing"
              ? ja.rain.analysing
              : ja.rain.record}
        </button>
      </div>

      {attempt.kind === "problem" ? <p className={styles.problem}>{attempt.message}</p> : null}

      {attempt.kind === "done" ? (
        <div className={styles.result} aria-live="polite">
          <PitchLines
            label={`${word.hanzi} の手本とあなたの声の高さの線`}
            lines={[
              { line: partner.lines[attempt.voice] ?? Object.values(partner.lines)[0] ?? [], kind: "other" },
              { line: word.lines[attempt.voice] ?? [], kind: "model" },
              { line: attempt.line, kind: "own" },
            ]}
          />
          <ul className={styles.legend}>
            <li className={styles.keyOwn}>{ja.rain.yourLine}</li>
            <li>
              {ja.rain.modelLine} <span className={styles.t}>{word.hanzi}</span>
            </li>
            <li className={styles.keyOther}>
              <span className={styles.t}>{partner.hanzi}</span> {partner.pinyin}
            </li>
          </ul>
          {byTone ? (
            <p className={styles.verdict} data-right={attempt.nearer === "word" ? "" : undefined}>
              {attempt.nearer === "word"
                ? ja.rain.nearer(word.hanzi)
                : attempt.nearer === "partner"
                  ? ja.rain.nearer(partner.hanzi)
                  : ja.rain.undecided}
            </p>
          ) : null}
          {attempt.vowel !== undefined ? (
            <>
              <p className={styles.verdict} data-right={attempt.vowel === "word" ? "" : undefined}>
                {attempt.vowel === "word"
                  ? ja.rain.vowelNearer(word.hanzi)
                  : attempt.vowel === "partner"
                    ? ja.rain.vowelNearer(partner.hanzi)
                    : ja.rain.vowelUndecided}
              </p>
              <p className={styles.hint}>{ja.rain.vowelNote}</p>
            </>
          ) : (
            <p className={styles.heard}>
              {ja.rain.heard}：
              {attempt.heard === "pending" ? (
                "…"
              ) : attempt.heard === "unavailable" ? (
                ja.rain.hearUnavailable
              ) : attempt.heard === "none" ? (
                "—"
              ) : (
                <>
                  <span className={styles.t}>{attempt.heard.text}</span> {attempt.heard.pinyin}
                  {attempt.heard.text === word.hanzi ? <span className={styles.through}>{ja.rain.through}</span> : null}
                  {attempt.heard.text === partner.hanzi ? (
                    <span className={styles.asPartner}>{ja.rain.asPartner(partner.hanzi)}</span>
                  ) : null}
                </>
              )}
            </p>
          )}
        </div>
      ) : null}
    </li>
  );
}
