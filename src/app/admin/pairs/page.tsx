import { connection } from "next/server";
import { readJson, readText, type AdminWord, type Clips } from "@/lib/admin";
import type { FamilyData } from "@/lib/data";
import { ja, type FamilyId } from "@/lib/i18n/ja";
import { meaningOf, parsePairs } from "@/lib/pairs-file";
import { removePairAction } from "../actions";
import { AddPairForm, MeaningForm } from "./PairForms";
import styles from "../admin.module.css";

const name = (id: string) => ja.families[id as FamilyId]?.name ?? id;

/**
 * 語の組: every pair of data/pairs.txt by difference, how many voices each word passes in, whether the pair is in the
 * app, and its ことのあめ sentences; pairs can be taken out, added, and meanings fixed (all in data/pairs.txt).
 */
export default async function PairsAdmin() {
  await connection();
  const text = readText("data/pairs.txt");
  const { families, pairs } = parsePairs(text);
  const compiled = new Map(readJson<AdminWord[]>("data/words.json", []).map((w) => [`${w.hanzi}|${w.pinyin}`, w]));
  const clips = readJson<Clips>("data/clips.json", { voices: [], clips: {} });
  const sentences = readJson<Record<string, unknown[]>>("data/sentences.json", {});
  const inApp = new Set<string>();
  for (const f of families) {
    const data = readJson<FamilyData | null>(`public/data/f/${f}.json`, null);
    for (const p of data?.pairs ?? []) inApp.add(`${p.a}+${p.b}`);
  }
  const voicesOf = (id?: string) =>
    id ? clips.voices.filter((v) => clips.clips[`${v.id}/${id}`]?.status === "pass").length : 0;

  const wordOptions = new Map<string, { key: string; label: string; ja: string }>();
  for (const p of pairs) {
    for (const s of [p.a, p.b]) {
      const key = `${s.hanzi}|${s.pinyin}`;
      if (!wordOptions.has(key)) wordOptions.set(key, { key, label: `${s.hanzi} ${s.pinyin}`, ja: meaningOf(text, s) });
    }
  }

  return (
    <>
      <h1 className={styles.h1}>語の組（{pairs.length}）</h1>
      <p className={styles.lead}>
        変更は data/pairs.txt
        に書かれます（外した組は「#外した」として残ります）。終わったら概要の「語の組を反映」、新しい語があれば「足りない音声を作る」を。
      </p>

      <section className={styles.section}>
        <h2 className={styles.h2}>組を足す</h2>
        <AddPairForm families={families.map((id) => ({ id, name: name(id) }))} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>意味を直す</h2>
        <MeaningForm words={[...wordOptions.values()]} />
      </section>

      {families.map((f) => {
        const list = pairs.filter((p) => p.family === f);
        return (
          <section key={f} className={styles.family}>
            <h2 className={styles.h2}>
              {f} {name(f)}（{list.length}）
            </h2>
            {list.map((p) => {
              const a = compiled.get(`${p.a.hanzi}|${p.a.pinyin}`);
              const b = compiled.get(`${p.b.hanzi}|${p.b.pinyin}`);
              const shown = a && b && (inApp.has(`${a.id}+${b.id}`) || inApp.has(`${b.id}+${a.id}`));
              const said = (w?: AdminWord) => (w ? (sentences[w.id]?.length ?? 0) : 0);
              return (
                <div key={p.index} className={`${styles.pairRow} ${shown ? "" : styles.out}`}>
                  <span className={styles.pairWords}>
                    {[
                      [p.a, a],
                      [p.b, b],
                    ].map(([s, w]) => {
                      const side = s as typeof p.a;
                      const word = w as AdminWord | undefined;
                      return (
                        <span key={side.hanzi} className={styles.pairWords}>
                          <span className={styles.zh} lang="zh-CN">
                            {side.hanzi}
                          </span>
                          <span className={styles.py}>{side.pinyin}</span>
                          <span className={styles.meta}>
                            {meaningOf(text, side)} · 声 {voicesOf(word?.id)}/{clips.voices.length} · 例文 {said(word)}
                          </span>
                        </span>
                      );
                    })}
                    {shown ? null : <span className={styles.tagAgain}>{a && b ? "アプリに出ていない" : "未反映"}</span>}
                  </span>
                  <form
                    action={removePairAction.bind(
                      null,
                      { hanzi: p.a.hanzi, pinyin: p.a.pinyin },
                      { hanzi: p.b.hanzi, pinyin: p.b.pinyin },
                    )}
                  >
                    <button type="submit" className={`${styles.button} ${styles.danger}`}>
                      外す
                    </button>
                  </form>
                </div>
              );
            })}
          </section>
        );
      })}
    </>
  );
}
