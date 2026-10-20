import Link from "next/link";
import { connection } from "next/server";
import { JOBS, modifiedAt, readJson, type AdminWord, type Clips, type JobKind, type ReviewItem } from "@/lib/admin";
import type { Index } from "@/lib/data";
import { JobPanel } from "./JobPanel";
import styles from "./admin.module.css";

/** 概要: how the content stands, what waits for a person, and the steps that carry changes into the app. */
export default async function AdminHome() {
  await connection();
  const words = readJson<AdminWord[]>("data/words.json", []);
  const families = readJson<{ id: string; pairs: unknown[] }[]>("data/families.json", []);
  const clips = readJson<Clips>("data/clips.json", { voices: [], clips: {} });
  const review = readJson<ReviewItem[]>("data/review.json", []);
  const approved = readJson<string[]>("data/approved.json", []);
  const dismissed = new Set(readJson<string[]>("data/dismissed.json", []));
  const sentences = readJson<Record<string, unknown[]>>("data/sentences.json", {});
  const index = readJson<Index | null>("public/data/index.json", null);

  const all = Object.values(clips.clips);
  const pass = all.filter((c) => c.status === "pass").length;
  const waiting = review.filter((r) => !dismissed.has(`${r.voice}/${r.id}`)).length;
  const toApply = approved.filter((k) => {
    const [voiceId, take] = [k.slice(0, k.lastIndexOf(".")), Number(k.slice(k.lastIndexOf(".") + 1))];
    const c = clips.clips[voiceId];
    return !(c?.status === "pass" && c.attempt === take);
  }).length;
  const pairsChanged = modifiedAt("data/pairs.txt") > modifiedAt("data/words.json");
  const missing = words.length * clips.voices.length - all.length;
  const inApp = index?.families.reduce((n, f) => n + f.pairs, 0) ?? 0;
  const allPairs = families.reduce((n, f) => n + f.pairs.length, 0);

  return (
    <>
      <h1 className={styles.h1}>概要</h1>
      <dl className={styles.stats}>
        <div>
          <dt>語</dt>
          <dd>{words.length}</dd>
        </div>
        <div>
          <dt>語の組（アプリに出ている）</dt>
          <dd>
            {inApp} / {allPairs}
          </dd>
        </div>
        <div>
          <dt>合格した音声</dt>
          <dd>
            {pass} / {words.length * clips.voices.length}
          </dd>
        </div>
        <div>
          <dt>確認待ち</dt>
          <dd>{waiting}</dd>
        </div>
        <div>
          <dt>例文のある語</dt>
          <dd>{Object.keys(sentences).length}</dd>
        </div>
      </dl>

      {pairsChanged ? (
        <p className={styles.warn}>
          data/pairs.txt が変わっています。「語の組を反映」で検査して、新しい語があれば「足りない音声を作る」を。
        </p>
      ) : null}
      {toApply ? (
        <p className={styles.warn}>使うと決めた音声が {toApply} 本あります。「音声の合否を反映」でアプリに入ります。</p>
      ) : null}
      {missing > 0 ? (
        <p className={styles.warn}>まだ作っていない音声が {missing} 本あります（「足りない音声を作る」）。</p>
      ) : null}
      {waiting ? (
        <p className={styles.lead}>
          機械が通せなかった音声が {waiting} 本、<Link href="/admin/audio">確認待ちの音声</Link>
          で人が聞くのを待っています。
        </p>
      ) : null}

      <section className={styles.section}>
        <h2 className={styles.h2}>反映する</h2>
        <JobPanel
          jobs={(Object.keys(JOBS) as JobKind[]).map((kind) => ({
            kind,
            label: JOBS[kind].label,
            note: JOBS[kind].note,
          }))}
        />
      </section>
    </>
  );
}
