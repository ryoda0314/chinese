"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { play, unlock } from "@/components/player";
import { audioUrl } from "@/lib/data";
import styles from "./page.module.css";

type Word = { id: string; hanzi: string; pinyin: string; kind: "answer" | "model" };

/** The intro's two words, each a button that says it (in the next voice each time): the difference heard first. */
export function HearPair({ words, voices }: { words: Word[]; voices: string[] }) {
  const [playing, setPlaying] = useState<string | null>(null);
  const [turn, setTurn] = useState(0);
  return (
    <figcaption className={styles.caption}>
      {words.map((w) => (
        <button
          key={w.id}
          type="button"
          className={`${styles.hear} ${w.kind === "answer" ? styles.keyAnswer : styles.keyModel}`}
          data-playing={playing === w.id ? "" : undefined}
          onClick={async () => {
            unlock();
            setPlaying(w.id);
            setTurn((t) => t + 1);
            await play(audioUrl(voices[turn % voices.length], w.id));
            setPlaying((p) => (p === w.id ? null : p));
          }}
        >
          <span className="t-zh">{w.hanzi}</span> {w.pinyin}
          <Icon name="speaker" size={16} />
        </button>
      ))}
    </figcaption>
  );
}
