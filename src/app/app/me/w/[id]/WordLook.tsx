"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Icon } from "@/components/Icon";
import { PitchLines } from "@/components/PitchLines";
import { ja } from "@/lib/i18n/ja";
import { learnerCenter, nearestVoice } from "@/lib/learner";
import { forgetSaid, saidByWord, type SaidLog } from "@/lib/log-core";
import type { State } from "@/lib/rain-core";
import { SayCard } from "../../../_rain/Say";
import { useFamilies, useRecord } from "../../useRecord";
import styles from "../../me.module.css";

const t = ja.me.word;
const when = (ms: number) =>
  new Date(ms).toLocaleString("ja-JP", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
const dateOnly = (ms: number) =>
  new Date(ms).toLocaleDateString("ja-JP", { month: "long", day: "numeric", timeZone: "Asia/Tokyo" });

/**
 * One word the learner has said: their first line and their latest over the model, every attempt with what it was
 * nearer and what it was heard as, and the chance to say it again (which joins the list).
 */
export function WordLook({ id }: { id: string }) {
  const { state, update } = useRecord();
  const latest = useRef<State | null>(null);
  useEffect(() => {
    latest.current = state;
  }, [state]);

  const attempts = saidByWord(state?.log).find((s) => s.word === id)?.attempts ?? [];
  const family = attempts[0]?.family;
  const { families, index } = useFamilies(family ? [family] : []);
  const data = family ? families.get(family) : undefined;

  const back = (
    <Link href="/app/me" className={styles.back}>
      <Icon name="back" size={18} />
      {t.back}
    </Link>
  );
  if (!state) return <div className={styles.page}>{back}</div>;
  if (!attempts.length) {
    return (
      <div className={styles.page}>
        {back}
        <p className={styles.lead}>{t.notFound}</p>
      </div>
    );
  }

  const first = attempts[0];
  const last = attempts[attempts.length - 1];
  const word = data?.words[id];
  const partner = data?.words[last.partner];
  const voice = word && index ? nearestVoice(index.voices, learnerCenter(state.voice), Object.keys(word.lines)) : null;
  const nameOf = (a: SaidLog, v: "word" | "partner") => (v === "word" ? word?.hanzi : partner?.hanzi) ?? "";
  const verdict = (a: SaidLog) => {
    if (a.vowel !== undefined) return a.vowel ? t.vowelNearer(nameOf(a, a.vowel)) : t.undecided;
    if (a.nearer !== undefined) return a.nearer ? t.nearer(nameOf(a, a.nearer)) : t.undecided;
    return null;
  };

  return (
    <div className={styles.page}>
      {back}
      {word ? (
        <h1 className={styles.h2}>
          <span className={styles.zh} lang="zh-CN">
            {word.hanzi}
          </span>{" "}
          <span className={styles.meta}>
            {word.pinyin} · {word.ja}
          </span>
        </h1>
      ) : null}
      <p className={styles.lead}>{t.lead}</p>

      {word && voice ? (
        <section className={styles.section}>
          <PitchLines
            label={`${word.hanzi} の手本と、最初と最近の声の線`}
            lines={[
              ...(partner?.lines[voice] ? [{ line: partner.lines[voice], kind: "other" as const }] : []),
              { line: word.lines[voice] ?? [], kind: "model" as const },
              ...(attempts.length > 1 ? [{ line: first.line, kind: "past" as const }] : []),
              { line: last.line, kind: "own" as const },
            ]}
          />
          <ul className={styles.legend}>
            <li className={styles.keyOwn}>{t.latest(dateOnly(last.at))}</li>
            {attempts.length > 1 ? <li className={styles.keyPast}>{t.first(dateOnly(first.at))}</li> : null}
            <li>{t.model}</li>
            {partner ? <li className={styles.keyOther}>{t.partner(partner.hanzi)}</li> : null}
          </ul>
        </section>
      ) : null}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t.attempts}</h2>
        <ul className={styles.list}>
          {[...attempts].reverse().map((a) => {
            const v = verdict(a);
            const right = a.vowel === "word" || (a.vowel === undefined && a.nearer === "word");
            return (
              <li key={a.at} className={styles.attempt}>
                <span className={styles.attemptHead}>
                  <span>{when(a.at)}</span>
                </span>
                {v ? (
                  <span className={styles.verdict} data-right={right ? "" : undefined}>
                    {v}
                  </span>
                ) : null}
                {a.heard ? <span className={styles.meta}>{t.heard(a.heard)}</span> : null}
              </li>
            );
          })}
        </ul>
      </section>

      {word && partner && index && family ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.again}</h2>
          <ul className={styles.sayList}>
            <SayCard
              word={word}
              partner={partner}
              family={family}
              voices={index.voices}
              getState={() => latest.current ?? state}
              update={update}
            />
          </ul>
        </section>
      ) : null}

      <button
        type="button"
        className={styles.danger}
        onClick={() => {
          if (window.confirm(t.forgetConfirm)) update({ ...state, log: forgetSaid(state.log, id) });
        }}
      >
        {t.forget}
      </button>
    </div>
  );
}
