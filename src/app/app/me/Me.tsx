"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FamilyData, Index } from "@/lib/data";
import { ja } from "@/lib/i18n/ja";
import { ORDER, owedPairs, type State } from "@/lib/rain-core";
import { loadState } from "@/lib/store";
import { account, resetRecord, signOut, syncRecord, type Account } from "@/lib/sync";
import styles from "./me.module.css";

const date = (ms: number) => new Date(ms).toLocaleDateString("ja-JP", { month: "long", day: "numeric" });

/** The data of the differences bathed in (for the names of the pairs coming back). Empty when it cannot be fetched. */
async function familiesOf(s: State): Promise<Map<string, FamilyData>> {
  const bathed = ORDER.filter((id) => s.families[id]?.rains);
  try {
    const index: Index = await fetch("/data/index.json", { cache: "no-cache" }).then((r) => r.json());
    const list = await Promise.all(
      bathed
        .filter((id) => index.families.some((f) => f.id === id))
        .map((id) => fetch(`/data/f/${id}.json?v=${index.version}`).then((r) => r.json() as Promise<FamilyData>)),
    );
    return new Map(list.map((f) => [f.id, f]));
  } catch {
    return new Map();
  }
}

/** 自分: the rains bathed in, by difference, with the day each started to sound apart and the pairs coming back. */
export function Me() {
  const [state, setState] = useState<State | null>(null);
  const [me, setMe] = useState<Account | null | undefined>(undefined);
  const [families, setFamilies] = useState<Map<string, FamilyData>>(new Map());

  useEffect(() => {
    void account().then(setMe);
    // The device's record first, then (when signed in) merged with the account's.
    const local = loadState();
    const first = window.setTimeout(() => setState(local), 0);
    void syncRecord().then(async (s) => {
      setState(s);
      setFamilies(await familiesOf(s));
    });
    return () => window.clearTimeout(first);
  }, []);

  if (!state) return <div className={styles.page} />;
  const bathed = ORDER.filter((id) => state.families[id]?.rains);

  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>{ja.me.title}</h1>
      <p className={styles.lead}>{ja.me.lead}</p>
      {me !== undefined ? (
        <section className={styles.account}>
          <h2 className={styles.accountTitle}>{ja.me.account}</h2>
          {me ? (
            <>
              <p className={styles.linked}>{ja.me.linked(me.email ?? "")}</p>
              <p className={styles.lead}>{ja.me.linkedLead}</p>
              <button
                type="button"
                className={styles.textButton}
                onClick={async () => {
                  await signOut();
                  setMe(null);
                }}
              >
                {ja.me.unlink}
              </button>
            </>
          ) : (
            <>
              <p className={styles.lead}>{ja.me.linkLead}</p>
              <Link href="/login?next=/app/me" className="btn-quiet">
                {ja.me.link}
              </Link>
            </>
          )}
        </section>
      ) : null}
      {state.rains === 0 ? (
        <p className={styles.lead}>{ja.me.empty}</p>
      ) : (
        <>
          <p className={styles.count}>{ja.me.rains(state.rains)}</p>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{ja.me.families}</h2>
            <ul className={styles.list}>
              {bathed.map((id) => {
                const f = state.families[id]!;
                const data = families.get(id);
                const owed = data ? owedPairs(state, data) : [];
                return (
                  <li key={id} className={styles.row}>
                    <div className={styles.rowHead}>
                      <span className={styles.name}>{ja.families[id].name}</span>
                      <span className={styles.meta}>{ja.me.familyRains(f.rains)}</span>
                    </div>
                    {f.splitAt ? <p className={styles.split}>{ja.me.splitSince(date(f.splitAt))}</p> : null}
                    {owed.length ? (
                      <p className={styles.owed}>
                        <span className={styles.owedLabel}>{ja.me.returning}</span>
                        {owed.map((p) => (
                          <span key={p.a + p.b} className={styles.owedPair} lang="zh-CN">
                            {data!.words[p.a].hanzi}／{data!.words[p.b].hanzi}
                          </span>
                        ))}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
          <button
            type="button"
            className={styles.reset}
            onClick={async () => {
              if (window.confirm(me ? ja.me.resetLinkedConfirm : ja.me.resetConfirm)) {
                await resetRecord();
                setState(loadState());
              }
            }}
          >
            {me ? ja.me.resetLinked : ja.me.reset}
          </button>
        </>
      )}
    </div>
  );
}
