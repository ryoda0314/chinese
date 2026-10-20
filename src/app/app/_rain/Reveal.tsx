import type { FamilyData, PairData } from "@/lib/data";
import { ja } from "@/lib/i18n/ja";
import styles from "./rain.module.css";

/**
 * 違いのこと: only now, after listening, the difference gets its name and a word on how it is made (CONCEPT.md: 表は後から).
 * The pairs mixed up in this rain are named as coming back, in ことのあめ's violet.
 */
export function Reveal({
  family,
  missed,
  split,
  next,
  onNext,
}: {
  family: FamilyData;
  missed: PairData[];
  split: boolean;
  next: "sentences" | "say";
  onNext: (step: "sentences" | "say") => void;
}) {
  const f = ja.families[family.id];
  return (
    <>
      <section className={styles.reveal}>
        <p className={styles.revealLabel}>{ja.rain.revealTitle}</p>
        <h2 className={styles.revealName}>{f.name}</h2>
        <p className={styles.revealHint}>{f.hint}</p>
        {split ? <p className={styles.split}>{ja.rain.splitNow(f.name)}</p> : null}
      </section>
      {missed.length ? (
        <section className={styles.owed}>
          <p className={styles.hint}>{ja.rain.comesBack}</p>
          <ul className={styles.owedList}>
            {missed.map((p) => (
              <li key={p.a + p.b}>
                {family.words[p.a].hanzi}
                <span className={styles.py}>{family.words[p.a].pinyin}</span>
                {" ／ "}
                {family.words[p.b].hanzi}
                <span className={styles.py}>{family.words[p.b].pinyin}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className={styles.actions}>
        <button type="button" className="btn" onClick={() => onNext(next)}>
          {next === "sentences" ? ja.rain.toSentences : ja.rain.toSay}
        </button>
      </div>
    </>
  );
}
