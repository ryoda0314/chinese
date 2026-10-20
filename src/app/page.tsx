import { existsSync, readFileSync } from "node:fs";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { PitchLines } from "@/components/PitchLines";
import type { FamilyData, Line } from "@/lib/data";
import { ja } from "@/lib/i18n/ja";
import { HearPair } from "./HearPair";
import styles from "./page.module.css";

const XUE2 = "da4xue2-858b";
const XUE3 = "da4xue3-7c72";
// As the generated voices say them, should the data not be there: dà falls, then xué rises late while xuě stays low.
const DRAWN: Record<string, Line> = {
  [XUE2]: [5, 5, 4.8, 4.5, 4.1, 3.6, 3.1, 2.7, null, null, null, 2.5, 2.4, 2.4, 2.6, 3, 3.6, 4.1, 4.5, 4.6],
  [XUE3]: [5, 5, 4.8, 4.5, 4.1, 3.6, 3.1, 2.7, null, null, null, 2.4, 2.1, 1.7, 1.4, 1.2, 1.1, 1.2, 1.5, 1.9],
};

/** The real lines of 大学 and 大雪 in one voice (read when the page is built), and the voices that have both. */
function daxue(): { lines: Record<string, Line>; voices: string[] } {
  const file = "public/data/f/t23.json";
  const f: FamilyData | null = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  const a = f?.words[XUE2]?.lines;
  const b = f?.words[XUE3]?.lines;
  const gaps = (l: Line) => l.filter((v) => v === null).length;
  // The voice whose two lines break least (a creaky third tone leaves gaps), so the difference shows best.
  const voices = a && b ? Object.keys(a).filter((v) => b[v]).sort((p, q) => gaps(a[p]) + gaps(b[p]) - gaps(a[q]) - gaps(b[q])) : [];
  if (!a || !b || !voices.length) return { lines: DRAWN, voices: ["kore"] };
  return { lines: { [XUE2]: a[voices[0]], [XUE3]: b[voices[0]] }, voices };
}

export default function Home() {
  const { lines, voices } = daxue();
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Logo size="lg" href={null} />
      </header>
      <section className={styles.hero}>
        <h1 className={styles.lead}>{ja.intro.lead}</h1>
        <figure className={styles.figure}>
          <PitchLines
            label="大学 dàxué は2つ目の音節で上がり、大雪 dàxuě は低く沈む"
            lines={[
              { line: lines[XUE2], kind: "answer" },
              { line: lines[XUE3], kind: "model" },
            ]}
          />
          <HearPair
            voices={voices}
            words={[
              { id: XUE2, hanzi: "大学", pinyin: "dàxué", kind: "answer" },
              { id: XUE3, hanzi: "大雪", pinyin: "dàxuě", kind: "model" },
            ]}
          />
        </figure>
        {ja.intro.body.map((p) => (
          <p key={p} className={styles.body}>
            {p}
          </p>
        ))}
        <Link href="/app" className={`btn ${styles.start}`}>
          {ja.intro.start}
        </Link>
        <p className={styles.note}>{ja.intro.note}</p>
        <Link href="/login?next=/app" className={styles.link}>
          {ja.intro.link}
        </Link>
      </section>
    </div>
  );
}
