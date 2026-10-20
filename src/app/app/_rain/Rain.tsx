"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { preload, stop } from "@/components/player";
import { audioUrl, type FamilyData, type Index, type PairData } from "@/lib/data";
import { ja } from "@/lib/i18n/ja";
import { finishRain, makeTrials, nextFamily, pickPairs, recordAnswer, type State, type Trial } from "@/lib/rain-core";
import { saveState } from "@/lib/store";
import { syncRecord } from "@/lib/sync";
import { Compare } from "./Compare";
import { Reveal } from "./Reveal";
import { Say } from "./Say";
import { Sentences, sentencesFor } from "./Sentences";
import { Tell } from "./Tell";
import styles from "./rain.module.css";

type Step = "compare" | "tell" | "reveal" | "sentences" | "say";
type Loaded = { id: number; index: Index; family: FamilyData; pairs: PairData[]; trials: Trial[] };

const STEPS: { step: Step | "reveal"; label: string }[] = [
  { step: "compare", label: ja.steps.compare },
  { step: "tell", label: ja.steps.tell },
  { step: "sentences", label: ja.steps.sentences },
  { step: "say", label: ja.steps.say },
];

/** One rain at a time: which difference falls is decided on the device, from the learner's own record. */
export function Rain() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [rain, setRain] = useState<Loaded | null>(null);
  const [step, setStep] = useState<Step>("compare");
  const [missed, setMissed] = useState<PairData[]>([]);
  const [split, setSplit] = useState(false);
  const state = useRef<State | null>(null);

  const update = useCallback((next: State) => {
    state.current = next;
    saveState(next);
  }, []);

  const load = useCallback(async () => {
    stop();
    try {
      const index: Index = await fetch("/data/index.json", { cache: "no-cache" }).then((r) => r.json());
      // The first rain starts from the device's record merged with the account's (when signed in).
      const s = state.current ?? (await syncRecord());
      state.current = s;
      const now = Date.now();
      const id = nextFamily(
        s,
        index.families.map((f) => f.id),
        now,
      );
      const family: FamilyData = await fetch(`/data/f/${id}.json?v=${index.version}`).then((r) => r.json());
      const pairs = pickPairs(s, family, now, Math.random);
      const trials = makeTrials(pairs, family, Math.random);
      setRain({ id: now, index, family, pairs, trials });
      setStep("compare");
      setMissed([]);
      setSplit(false);
      setStatus("ready");
      const words = pairs.flatMap((p) => [p.a, p.b]);
      void preload(words.flatMap((w) => Object.keys(family.words[w].lines).map((v) => audioUrl(v, w))));
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    // The first rain is chosen once the page is on the device, where the record is.
    const first = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(first);
      stop();
    };
  }, [load]);

  const next = () => {
    setStatus("loading");
    window.scrollTo({ top: 0 });
    void load();
  };

  if (status !== "ready" || !rain) {
    return (
      <div className={styles.page}>
        <div className={styles.center} role="status">
          {status === "error" ? (
            <>
              <p className={styles.lead}>{ja.rain.failed}</p>
              <button type="button" className="btn-quiet" onClick={next}>
                {ja.rain.retry}
              </button>
            </>
          ) : (
            <p className={styles.lead}>{ja.rain.loading}</p>
          )}
        </div>
      </div>
    );
  }

  const { id: rainId, family, pairs, trials, index } = rain;
  const sentences = sentencesFor(family, pairs, missed);
  const current = step === "reveal" ? "tell" : step;

  return (
    <div className={styles.page}>
      <ol className={styles.steps} aria-label="この雨の流れ">
        {STEPS.filter((s) => s.step !== "sentences" || sentences.length).map((s) => (
          <li key={s.step} aria-current={s.step === current ? "step" : undefined}>
            {s.label}
          </li>
        ))}
      </ol>

      {step === "compare" ? <Compare key={rainId} family={family} pairs={pairs} onDone={() => setStep("tell")} /> : null}

      {step === "tell" ? (
        <Tell
          key={rainId}
          family={family}
          trials={trials}
          onAnswer={(pair, right) => {
            update(recordAnswer(state.current as State, family.id, pair, right, Date.now()));
            if (!right) setMissed((m) => (m.includes(pair) ? m : [...m, pair]));
          }}
          onDone={() => {
            const done = finishRain(state.current as State, family.id, Date.now());
            update(done.state);
            setSplit(done.split);
            setStep("reveal");
          }}
        />
      ) : null}

      {step === "reveal" ? (
        <Reveal
          family={family}
          missed={missed}
          split={split}
          next={sentences.length ? "sentences" : "say"}
          onNext={(s) => setStep(s)}
        />
      ) : null}

      {step === "sentences" ? <Sentences key={rainId} sentences={sentences} onDone={() => setStep("say")} /> : null}

      {step === "say" ? (
        <Say
          key={rainId}
          family={family}
          pairs={pairs}
          missed={missed}
          voices={index.voices}
          getState={() => state.current as State}
          update={update}
        />
      ) : null}

      {step === "reveal" || step === "sentences" || step === "say" ? (
        <div className={styles.end}>
          <button type="button" className={step === "say" ? "btn" : "btn-quiet"} onClick={next}>
            {ja.rain.nextRain}
          </button>
        </div>
      ) : null}
    </div>
  );
}
