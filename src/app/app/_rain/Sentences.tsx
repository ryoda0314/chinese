"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { play, stop } from "@/components/player";
import type { FamilyData, PairData, Sentence, WordData } from "@/lib/data";
import { ja } from "@/lib/i18n/ja";
import styles from "./rain.module.css";

const HAN = /\p{Script=Han}/u;
const MAX = 2;

export type Found = { word: WordData; sentence: Sentence };

/** Up to two sentences for this rain: for the words mixed up first, then the others, one per word, shortest first. */
export function sentencesFor(family: FamilyData, pairs: PairData[], missed: PairData[]): Found[] {
  const order = [...missed, ...pairs.filter((p) => !missed.includes(p))].flatMap((p) => [p.a, p.b]);
  const out: Found[] = [];
  for (const id of order) {
    const s = family.sentences[id]?.[0];
    if (s && !out.some((f) => f.sentence.zh === s.zh)) out.push({ word: family.words[id], sentence: s });
    if (out.length === MAX) break;
  }
  return out;
}

/** A sentence with pinyin over each character and the word lit. */
function Ruby({ sentence, length }: { sentence: Sentence; length: number }) {
  const syllables = sentence.pinyin.trim().split(/\s+/);
  let k = 0;
  return (
    <p className={styles.zh} lang="zh-CN">
      {[...sentence.zh].map((ch, i) => {
        if (!HAN.test(ch)) return <span key={i}>{ch}</span>;
        const index = k++;
        const lit = index >= sentence.at && index < sentence.at + length;
        return (
          <ruby key={i} className={lit ? styles.target : undefined}>
            {ch}
            <rt>{syllables[index]}</rt>
          </ruby>
        );
      })}
    </p>
  );
}

/** 文の中で: the same words, now inside sentences friends send each other (from ことのあめ), to find by ear. */
export function Sentences({ sentences, onDone }: { sentences: Found[]; onDone: () => void }) {
  const [playing, setPlaying] = useState<number | null>(null);
  const [shown, setShown] = useState<Set<number>>(new Set());

  const hear = async (i: number) => {
    setPlaying(i);
    await play(sentences[i].sentence.audio);
    setPlaying((p) => (p === i ? null : p));
  };

  useEffect(() => {
    const start = window.setTimeout(() => void hear(0), 400);
    return () => {
      window.clearTimeout(start);
      stop();
    };
    // Once, when the sentences come up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <p className={styles.lead}>{ja.rain.sentencesLead}</p>
      <ul className={styles.sentences}>
        {sentences.map((f, i) => (
          <li key={f.sentence.zh} className={styles.sentence} style={{ animationDelay: `${i * 0.25}s` }}>
            <button
              type="button"
              className={styles.speak}
              data-playing={playing === i ? "" : undefined}
              onClick={() => void hear(i)}
              aria-label={f.sentence.zh}
            >
              <Icon name="speaker" />
            </button>
            <div>
              <Ruby sentence={f.sentence} length={[...f.word.hanzi].length} />
              {shown.has(i) ? (
                <p className={styles.ja}>{f.sentence.ja}</p>
              ) : (
                <button type="button" className={styles.toggle} onClick={() => setShown(new Set([...shown, i]))}>
                  {ja.rain.showTranslation}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className={styles.actions}>
        <button type="button" className="btn" onClick={onDone}>
          {ja.rain.toSay}
        </button>
      </div>
    </>
  );
}
