"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { play, unlock } from "@/components/player";
import { audioUrl, type PairData, type WordData } from "@/lib/data";
import { ja, type FamilyId } from "@/lib/i18n/ja";
import { daysOfFamily } from "@/lib/log-core";
import { pairKey, type State } from "@/lib/rain-core";
import { useFamilies, useRecord } from "../../useRecord";
import styles from "../../me.module.css";

const t = ja.me.family;
const dateJa = (day: string) => {
  const [, m, d] = day.split("-").map(Number);
  return `${m}月${d}日`;
};

type Group = keyof typeof t.groups;

function groupOf(state: State, p: PairData): Group {
  const s = state.pairs[pairKey(p)];
  if (!s?.seen) return "unmet";
  if (s.owed) return "owed";
  return s.missed ? "missedBefore" : "clear";
}

/** One difference looked back on: how it is made (heard by now), its days, and each of its pairs as met so far. */
export function FamilyLook({ id }: { id: FamilyId }) {
  const { state } = useRecord();
  const { families } = useFamilies([id]);
  const [playing, setPlaying] = useState<string | null>(null);
  const [turn, setTurn] = useState(0);
  const data = families.get(id);
  const f = state?.families[id];

  async function hear(w: WordData) {
    unlock();
    const voices = Object.keys(w.lines);
    if (!voices.length) return;
    setPlaying(w.id);
    // A different voice each press.
    setTurn(turn + 1);
    await play(audioUrl(voices[turn % voices.length], w.id));
    setPlaying((p) => (p === w.id ? null : p));
  }

  const back = (
    <Link href="/app/me" className={styles.back}>
      <Icon name="back" size={18} />
      {t.back}
    </Link>
  );
  if (!state) return <div className={styles.page}>{back}</div>;
  if (!f?.rains) {
    return (
      <div className={styles.page}>
        {back}
        <p className={styles.lead}>{t.notYet}</p>
      </div>
    );
  }

  const name = ja.families[id];
  const days = daysOfFamily(state.log, id);
  const groups: Record<Group, PairData[]> = { owed: [], missedBefore: [], clear: [], unmet: [] };
  for (const p of data?.pairs ?? []) groups[groupOf(state, p)].push(p);

  const pairList = (g: Group) =>
    data ? (
      <ul className={styles.list}>
        {groups[g].map((p) => {
          const s = state.pairs[pairKey(p)];
          return (
            <li
              key={pairKey(p)}
              className={`${styles.pairRow} ${g === "owed" ? styles.owedRow : ""} ${g === "unmet" ? styles.dim : ""}`}
            >
              <span className={styles.pairWords}>
                {[data.words[p.a], data.words[p.b]].map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    className={styles.wordButton}
                    data-playing={playing === w.id ? "" : undefined}
                    onClick={() => void hear(w)}
                    aria-label={t.hearLabel(w.hanzi)}
                  >
                    <span className={styles.zhSmall} lang="zh-CN">
                      {w.hanzi}
                    </span>
                    <span className={styles.py}>{w.pinyin}</span>
                  </button>
                ))}
              </span>
              {s?.seen ? <span className={styles.meta}>{t.met(s.seen, s.missed)}</span> : null}
            </li>
          );
        })}
      </ul>
    ) : null;

  return (
    <div className={styles.page}>
      {back}
      <h1 className={styles.h2}>{name.name}</h1>
      <p className={styles.factRow}>
        <span>{ja.me.familyRains(f.rains)}</span>
        {f.lastAt ? (
          <span>{new Date(f.lastAt).toLocaleDateString("ja-JP", { month: "long", day: "numeric" })}</span>
        ) : null}
      </p>
      {f.splitAt ? (
        <p className={styles.split}>
          {ja.me.splitSince(new Date(f.splitAt).toLocaleDateString("ja-JP", { month: "long", day: "numeric" }))}
        </p>
      ) : null}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t.howMade}</h2>
        <p className={styles.hint}>{name.hint}</p>
      </section>

      {days.length ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.days}</h2>
          <ul className={styles.dayChips}>
            {days.map((d) => (
              <li key={d}>{dateJa(d)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {data
        ? (Object.keys(groups) as Group[])
            .filter((g) => groups[g].length)
            .map((g) =>
              g === "unmet" ? (
                // Not met yet: only how many, opened on request, so the pairs met stay in view.
                <details key={g} className={styles.section}>
                  <summary className={styles.groupTitle}>
                    {t.groups[g]}（{groups[g].length}）
                  </summary>
                  {pairList(g)}
                </details>
              ) : (
                <section key={g} className={styles.section}>
                  <h2 className={styles.groupTitle}>
                    {t.groups[g]}（{groups[g].length}）
                  </h2>
                  {pairList(g)}
                </section>
              ),
            )
        : null}
    </div>
  );
}
