"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { PitchLines } from "@/components/PitchLines";
import { play, stop } from "@/components/player";
import { audioUrl, type FamilyData, type PairData } from "@/lib/data";
import { ja } from "@/lib/i18n/ja";
import type { Trial } from "@/lib/rain-core";
import { WordFace } from "./WordFace";
import styles from "./rain.module.css";

const NEXT_AFTER_RIGHT_MS = 1600;

/**
 * 聞き分ける: one word is said; which was it? The answer shows at once: the right word lights, and both words' pitch
 * lines in that voice are drawn. Right answers move on by themselves; after a wrong one the learner listens to both
 * as often as they like and moves on when ready. No score, only "n / 12" for where they are.
 */
export function Tell({
  family,
  trials,
  onAnswer,
  onDone,
}: {
  family: FamilyData;
  trials: Trial[];
  onAnswer: (pair: PairData, right: boolean) => void;
  onDone: () => void;
}) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<"a" | "b" | null>(null);
  const [playing, setPlaying] = useState<"q" | "a" | "b" | null>(null);
  const timer = useRef<number | null>(null);
  const t = trials[i];
  const words = useMemo(() => ({ a: family.words[t.pair.a], b: family.words[t.pair.b] }), [family, t]);
  // The trial's voice when the word has it, else one it has.
  const voiceFor = useCallback(
    (side: "a" | "b") => (words[side].lines[t.voice] ? t.voice : Object.keys(words[side].lines)[0]),
    [t, words],
  );

  const hear = useCallback(
    async (which: "q" | "a" | "b") => {
      const side = which === "q" ? t.answer : which;
      setPlaying(which);
      await play(audioUrl(voiceFor(side), words[side].id));
      setPlaying((p) => (p === which ? null : p));
    },
    [t, words, voiceFor],
  );

  const cancelTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => {
    const start = window.setTimeout(() => void hear("q"), 250);
    return () => window.clearTimeout(start);
    // Each question once, when it comes up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  useEffect(
    () => () => {
      cancelTimer();
      stop();
    },
    [],
  );

  function next() {
    cancelTimer();
    stop();
    if (i + 1 < trials.length) {
      setPicked(null);
      setI(i + 1);
    } else onDone();
  }

  function choose(side: "a" | "b") {
    if (picked) {
      cancelTimer();
      void hear(side);
      return;
    }
    setPicked(side);
    const right = side === t.answer;
    onAnswer(t.pair, right);
    if (right) timer.current = window.setTimeout(next, NEXT_AFTER_RIGHT_MS);
  }

  const stateOf = (side: "a" | "b") => {
    if (!picked) return undefined;
    if (side === t.answer) return "right";
    return side === picked ? "picked" : "dim";
  };
  const right = picked !== null && picked === t.answer;
  const answerWord = words[t.answer];
  const otherSide = t.answer === "a" ? "b" : "a";

  return (
    <>
      <div className={styles.trialHead}>
        <p className={styles.lead}>{ja.rain.tellLead}</p>
        <span className={styles.progress}>{ja.rain.trialOf(i + 1, trials.length)}</span>
      </div>
      <button
        type="button"
        className={styles.listen}
        data-playing={playing === "q" ? "" : undefined}
        onClick={() => {
          cancelTimer();
          void hear("q");
        }}
        aria-label={ja.rain.hearAgain}
      >
        <Icon name="speaker" size={34} />
      </button>
      <p className={styles.listenLabel}>{ja.rain.hearAgain}</p>

      <div className={styles.choices}>
        {(["a", "b"] as const).map((side) => (
          <button
            key={side}
            type="button"
            className={styles.choice}
            data-state={stateOf(side)}
            data-playing={playing === side ? "" : undefined}
            onClick={() => choose(side)}
          >
            <WordFace word={words[side]} />
          </button>
        ))}
      </div>

      {picked ? (
        <div className={styles.feedback} aria-live="polite">
          <p className={styles.message} data-right={right ? "" : undefined}>
            {right ? ja.rain.heardRight : ja.rain.heardWrong}
          </p>
          <PitchLines
            label={`${answerWord.hanzi} と ${words[otherSide].hanzi} の高さの線`}
            lines={[
              { line: words[otherSide].lines[voiceFor(otherSide)] ?? [], kind: "other" },
              { line: answerWord.lines[voiceFor(t.answer)] ?? [], kind: "answer" },
            ]}
          />
          <ul className={styles.legend}>
            <li className={styles.keyAnswer}>
              <span className={styles.t}>{answerWord.hanzi}</span> {answerWord.pinyin}
            </li>
            <li className={styles.keyOther}>
              <span className={styles.t}>{words[otherSide].hanzi}</span> {words[otherSide].pinyin}
            </li>
          </ul>
          <div className={styles.actions}>
            <button type="button" className={right ? "btn-quiet" : "btn"} onClick={next}>
              {ja.rain.next}
              <Icon name="arrow" size={18} />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
