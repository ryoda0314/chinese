"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { play, stop, unlock } from "@/components/player";
import { audioUrl, type FamilyData, type PairData } from "@/lib/data";
import { ja } from "@/lib/i18n/ja";
import { WordFace } from "./WordFace";
import styles from "./rain.module.css";

/** Voices both words of a pair have, so a pair is heard side by side in one voice. */
export function sharedVoices(family: FamilyData, pair: PairData): string[] {
  const b = new Set(Object.keys(family.words[pair.b].lines));
  const shared = Object.keys(family.words[pair.a].lines).filter((v) => b.has(v));
  return shared.length ? shared : Object.keys(family.words[pair.a].lines);
}

/**
 * 聞き比べる: the pairs fall one by one, each word said in turn, a different voice for each pair. Pressing a word stops
 * the fall (everything settles at once) and says that word again in the next voice.
 */
export function Compare({ family, pairs, onDone }: { family: FamilyData; pairs: PairData[]; onDone: () => void }) {
  const [shown, setShown] = useState(0);
  const [phase, setPhase] = useState<"start" | "falling" | "done">("start");
  const [playing, setPlaying] = useState<string | null>(null);
  const run = useRef(0);
  const turn = useRef<Record<string, number>>({});

  useEffect(
    () => () => {
      run.current++;
      stop();
    },
    [],
  );

  const wait = (id: number, ms: number) => new Promise<boolean>((r) => setTimeout(() => r(id === run.current), ms));

  async function fall() {
    unlock();
    const id = ++run.current;
    setPhase("falling");
    setShown(0);
    for (let i = 0; i < pairs.length; i++) {
      setShown(i + 1);
      if (!(await wait(id, 500))) return;
      const voices = sharedVoices(family, pairs[i]);
      const voice = voices[i % voices.length];
      for (const w of [pairs[i].a, pairs[i].b]) {
        setPlaying(w);
        await play(audioUrl(voice, w));
        setPlaying(null);
        if (!(await wait(id, 380))) return;
      }
      if (!(await wait(id, 450))) return;
    }
    setPhase("done");
  }

  function say(wordId: string, start: number) {
    unlock();
    run.current++;
    setShown(pairs.length);
    setPhase("done");
    const voices = Object.keys(family.words[wordId].lines);
    const k = (turn.current[wordId] ?? start) + 1;
    turn.current[wordId] = k;
    setPlaying(wordId);
    void play(audioUrl(voices[k % voices.length], wordId)).then(() => setPlaying((p) => (p === wordId ? null : p)));
  }

  return (
    <>
      <p className={styles.lead}>{ja.rain.compareLead}</p>
      {phase === "start" ? (
        <>
          <div className={styles.actions}>
            <button type="button" className="btn" onClick={fall}>
              <Icon name="speaker" />
              {ja.steps.compare}
            </button>
          </div>
          <p className={styles.hint}>{ja.rain.soundOn}</p>
        </>
      ) : null}
      {shown > 0 ? (
        <ul className={styles.pairs}>
          {pairs.slice(0, shown).map((p, i) => (
            <li key={p.a + p.b} className={styles.pair}>
              {[p.a, p.b].map((w) => (
                <button
                  key={w}
                  type="button"
                  className={styles.word}
                  data-playing={playing === w ? "" : undefined}
                  onClick={() => say(w, i)}
                >
                  <WordFace word={family.words[w]} />
                </button>
              ))}
            </li>
          ))}
        </ul>
      ) : null}
      {phase === "done" ? (
        <>
          <p className={styles.hint}>{ja.rain.tapToHear}</p>
          <div className={styles.actions}>
            <button
              type="button"
              className="btn"
              onClick={() => {
                unlock();
                run.current++;
                stop();
                onDone();
              }}
            >
              {ja.rain.toTell}
            </button>
            <button type="button" className="btn-quiet" onClick={fall}>
              <Icon name="replay" />
              {ja.rain.replayAll}
            </button>
          </div>
        </>
      ) : null}
    </>
  );
}
