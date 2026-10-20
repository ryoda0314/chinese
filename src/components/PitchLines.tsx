import type { Line } from "@/lib/data";
import styles from "./PitchLines.module.css";

export type DrawnLine = {
  line: Line;
  /**
   * model: a model voice, in ink. own: the learner's voice, in the accent. other: the word it is paired with, faint and
   * dashed. answer: the right word in 聞き分ける. past: an earlier line of the learner's, faint.
   */
  kind: "model" | "own" | "other" | "answer" | "past";
};

const W = 320;
const H = 120;
const PAD_X = 10;
// Room above level 5 and below level 1: a fourth tone often starts above a first tone, a third dips below the floor.
const TOP = 5.8;
const BOTTOM = 0.5;
const y = (level: number) => {
  const v = Math.max(BOTTOM, Math.min(TOP, level));
  return ((TOP - v) / (TOP - BOTTOM)) * H;
};

/** One line as path segments, broken where there was no voice. */
function path(line: Line): string {
  const n = line.length;
  let d = "";
  let open = false;
  line.forEach((v, k) => {
    if (v === null) {
      open = false;
      return;
    }
    const x = PAD_X + (n > 1 ? k / (n - 1) : 0.5) * (W - 2 * PAD_X);
    d += `${open ? "L" : "M"}${x.toFixed(1)} ${y(v).toFixed(1)}`;
    open = true;
  });
  return d;
}

/** Lines of pitch on five hairlines: low at the bottom, high at the top, no numbers. */
export function PitchLines({ lines, label, compact = false }: { lines: DrawnLine[]; label: string; compact?: boolean }) {
  return (
    <svg
      className={compact ? `${styles.svg} ${styles.compact}` : styles.svg}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      {[1, 2, 3, 4, 5].map((level) => (
        <line key={level} x1={0} x2={W} y1={y(level)} y2={y(level)} className={styles.rule} />
      ))}
      {/* Faint ones first, so the line that matters is drawn on top. */}
      {[...lines]
        .sort((a, b) => order(a.kind) - order(b.kind))
        .map((l, i) => (
          <path key={i} d={path(l.line)} className={styles[l.kind]} vectorEffect="non-scaling-stroke" />
        ))}
    </svg>
  );
}

const order = (k: DrawnLine["kind"]) => ({ other: 0, past: 1, model: 2, answer: 3, own: 4 })[k];
