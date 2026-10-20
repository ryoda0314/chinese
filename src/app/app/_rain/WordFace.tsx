import type { WordData } from "@/lib/data";
import styles from "./rain.module.css";

/** A word as it is shown everywhere: the characters, the pinyin with its tone marks, and what it means. */
export function WordFace({ word, again = false }: { word: WordData; again?: boolean }) {
  return (
    <>
      <span className={again ? `${styles.hanzi} ${styles.again}` : styles.hanzi} lang="zh-CN">
        {word.hanzi}
      </span>
      <span className={styles.pinyin} lang="zh-Latn-pinyin">
        {word.pinyin}
      </span>
      <span className={styles.gloss}>{word.ja}</span>
    </>
  );
}
