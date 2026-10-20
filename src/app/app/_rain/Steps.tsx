import { Icon } from "@/components/Icon";
import styles from "./steps.module.css";

type StepId = "compare" | "tell" | "sentences" | "say";

const ICONS = { compare: "pair", tell: "ear", sentences: "lines", say: "mic" } as const;

/**
 * Where the learner is in this rain: the steps on a track, those behind them checked, this one lit, those ahead faint.
 * A guide, not a score: nothing is counted.
 */
export function Steps({ steps, current }: { steps: { step: StepId; label: string }[]; current: StepId }) {
  const at = steps.findIndex((s) => s.step === current);
  return (
    <ol className={styles.steps} aria-label="この雨の流れ" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((s, i) => {
        const state = i < at ? "done" : i === at ? "now" : "next";
        return (
          <li key={s.step} className={styles.step} data-state={state} aria-current={state === "now" ? "step" : undefined}>
            <span className={styles.node} aria-hidden="true">
              <Icon name={state === "done" ? "check" : ICONS[s.step]} size={20} />
            </span>
            <span className={styles.label}>
              <span className={styles.number}>{i + 1}</span>
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
