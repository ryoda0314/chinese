"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PitchLines } from "@/components/PitchLines";
import { ja } from "@/lib/i18n/ja";
import { dayOf, daysOf, saidByWord } from "@/lib/log-core";
import { DAY, ORDER } from "@/lib/rain-core";
import { dayLabel, findWord, useFamilies, useRecord } from "./useRecord";
import styles from "./me.module.css";

type View = "days" | "families" | "said";
const VIEW_KEY = "kotonone:me-view";
const t = ja.me;

/** 自分: これまで, then the record looked back on by day, by difference, or by the words said. Never compared. */
export function Me() {
  const { state, me } = useRecord();
  const [view, setView] = useState<View>("days");
  const [now] = useState(() => Date.now());

  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY) as View | null;
      if (v === "days" || v === "families" || v === "said") {
        const first = window.setTimeout(() => setView(v), 0);
        return () => window.clearTimeout(first);
      }
    } catch {
      // the first view, then
    }
  }, []);

  const said = saidByWord(state?.log);
  const bathed = ORDER.filter((id) => state?.families[id]?.rains);
  const { families } = useFamilies([...bathed, ...said.map((s) => s.attempts[0].family)]);

  if (!state) return <div className={styles.page} />;

  const choose = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // not remembered this time
    }
  };

  const today = dayOf(now);
  const yesterday = dayOf(now - DAY);
  const days = daysOf(state.log);
  const logged = state.log?.rains.length ?? 0;
  const pairFace = (key: string) =>
    key
      .split("+")
      .map((id) => findWord(families, id)?.hanzi ?? "…")
      .join("／");

  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>{t.title}</h1>
      <p className={styles.lead}>{t.lead}</p>
      {me !== undefined ? (
        <p className={styles.accountLine}>
          {me ? t.linkedShort(me.email ?? "") : t.localShort}{" "}
          <Link href="/app/me/settings" className={styles.inlineLink}>
            {me ? t.settingsLink : t.connect}
          </Link>
        </p>
      ) : null}

      {state.rains === 0 ? (
        <p className={styles.lead}>{t.empty}</p>
      ) : (
        <>
          <section className={styles.section} aria-labelledby="sofar">
            <h2 id="sofar" className={styles.sectionTitle}>
              {t.sofar}
            </h2>
            <dl className={styles.stats}>
              <div>
                <dt>{t.stats.rains}</dt>
                <dd>
                  {state.rains}
                  <span>{t.statUnits.rains}</span>
                </dd>
              </div>
              <div>
                <dt>{t.stats.families}</dt>
                <dd>{bathed.length}</dd>
              </div>
              <div>
                <dt>{t.stats.said}</dt>
                <dd>{said.length}</dd>
              </div>
            </dl>
            <p className={styles.note}>{t.sofarNote}</p>
          </section>

          <section className={styles.section}>
            <div className={styles.tabs} role="tablist" aria-label={t.viewsLabel}>
              {(["days", "families", "said"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  className={view === v ? styles.tabOn : styles.tab}
                  onClick={() => choose(v)}
                >
                  {t.views[v]}
                </button>
              ))}
            </div>

            {view === "days" ? (
              <ul className={styles.list}>
                {days.map((d) => (
                  <li key={d.day} className={styles.day}>
                    <h3 className={styles.dayName}>{dayLabel(d.day, today, yesterday, t)}</h3>
                    {d.rains.length ? (
                      <p className={styles.dayLine}>
                        <span className={styles.dayKey}>{t.dayRains}</span>
                        <span>
                          {d.rains.map((r, i) => (
                            <span key={r.family}>
                              {i ? "、" : ""}
                              <Link href={`/app/me/d/${r.family}`} className={styles.plainLink}>
                                {t.rainsOf(ja.families[r.family].name, r.times)}
                              </Link>
                            </span>
                          ))}
                        </span>
                      </p>
                    ) : null}
                    {d.rains.some((r) => r.missed.length) ? (
                      <p className={styles.dayLine}>
                        <span className={styles.dayKey}>{t.dayMissed}</span>
                        <span className={styles.again} lang="zh-CN">
                          {[...new Set(d.rains.flatMap((r) => r.missed))].map(pairFace).join("　")}
                        </span>
                      </p>
                    ) : null}
                    {d.said.length ? (
                      <p className={styles.dayLine}>
                        <span className={styles.dayKey}>{t.daySaid}</span>
                        {d.said.map((w) => (
                          <Link key={w} href={`/app/me/w/${w}`} className={styles.zhLink} lang="zh-CN">
                            {findWord(families, w)?.hanzi ?? "…"}
                          </Link>
                        ))}
                      </p>
                    ) : null}
                  </li>
                ))}
                {state.rains > logged ? <li className={styles.note}>{t.olderNote}</li> : null}
              </ul>
            ) : null}

            {view === "families" ? (
              <>
                <ul className={styles.list}>
                  {bathed.map((id) => {
                    const f = state.families[id]!;
                    const owed = Object.values(state.pairs).filter((p) => p.family === id && p.owed).length;
                    return (
                      <li key={id}>
                        <Link href={`/app/me/d/${id}`} className={styles.rowLink}>
                          <span className={styles.rowHead}>
                            <span className={styles.name}>{ja.families[id].name}</span>
                            <span className={styles.meta}>{t.familyRains(f.rains)}</span>
                          </span>
                          {f.splitAt ? (
                            <span className={styles.split}>
                              {t.splitSince(
                                new Date(f.splitAt).toLocaleDateString("ja-JP", { month: "long", day: "numeric" }),
                              )}
                            </span>
                          ) : null}
                          {owed ? <span className={styles.againSmall}>{t.returningCount(owed)}</span> : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {ORDER.length > bathed.length ? (
                  <p className={styles.note}>{t.notYet(ORDER.length - bathed.length)}</p>
                ) : null}
              </>
            ) : null}

            {view === "said" ? (
              said.length ? (
                <ul className={styles.list}>
                  {said.map(({ word, attempts }) => {
                    const w = findWord(families, word);
                    const last = attempts[attempts.length - 1];
                    return (
                      <li key={word}>
                        <Link href={`/app/me/w/${word}`} className={styles.saidRow}>
                          <span className={styles.saidWord}>
                            <span className={styles.zh} lang="zh-CN">
                              {w?.hanzi ?? "…"}
                            </span>
                            <span className={styles.meta}>{w?.pinyin}</span>
                            <span className={styles.meta}>
                              {t.saidTimes(attempts.length)} · {dayLabel(dayOf(last.at), today, yesterday, t)}
                            </span>
                          </span>
                          <span className={styles.mini}>
                            <PitchLines
                              compact
                              label={`${w?.hanzi ?? ""} の最近の線`}
                              lines={[
                                ...(w ? [{ line: Object.values(w.lines)[0] ?? [], kind: "model" as const }] : []),
                                { line: last.line, kind: "answer" as const },
                              ]}
                            />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className={styles.lead}>{t.noSaid}</p>
              )
            ) : null}
          </section>
        </>
      )}

      <nav className={styles.more}>
        {state.rains ? (
          <Link href="/app/me/export" className={styles.moreLink}>
            {t.exportLink}
          </Link>
        ) : null}
        <Link href="/app/me/settings" className={styles.moreLink}>
          {t.settingsLink}
        </Link>
      </nav>
    </div>
  );
}
