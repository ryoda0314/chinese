import { connection } from "next/server";
import { readJson, takesOf, type AdminWord, type Clips, type ReviewItem } from "@/lib/admin";
import { approveTake, dismissClip, unapprove, undismiss } from "../actions";
import styles from "../admin.module.css";

/**
 * 確認待ちの音声: clips the machine could not pass in three takes. A person listens to each take, as the app would
 * play it, beside the same word in the other voices, and decides: これを使う (counts as passing after 音声の合否を反映)
 * or どれも使わない (the word goes without this voice and leaves the list).
 */
export default async function AudioReview() {
  await connection();
  const review = readJson<ReviewItem[]>("data/review.json", []);
  const clips = readJson<Clips>("data/clips.json", { voices: [], clips: {} });
  const words = new Map(readJson<AdminWord[]>("data/words.json", []).map((w) => [w.id, w]));
  const approved = readJson<string[]>("data/approved.json", []);
  const dismissed = new Set(readJson<string[]>("data/dismissed.json", []));
  const chosen = (voice: string, id: string) => {
    const k = approved.find((a) => a.startsWith(`${voice}/${id}.`));
    return k ? Number(k.slice(k.lastIndexOf(".") + 1)) : null;
  };
  const open = review.filter((r) => !dismissed.has(`${r.voice}/${r.id}`));
  const setAside = review.filter((r) => dismissed.has(`${r.voice}/${r.id}`));

  return (
    <>
      <h1 className={styles.h1}>確認待ちの音声（{open.length}）</h1>
      <p className={styles.lead}>
        機械の検査を3回とも通らなかった音声です。理由のほとんどは、音声認識が組の相手の語に聞いたこと（-n/-ng、息の強さ、そり舌）。耳で聞いて、正しく言えている
        take があれば「これを使う」を。決めたら概要の「音声の合否を反映」でアプリに入ります。
      </p>
      <ul className={styles.items}>
        {open.map((r) => {
          const w = words.get(r.id);
          const pick = chosen(r.voice, r.id);
          const others = clips.voices.filter(
            (v) => v.id !== r.voice && clips.clips[`${v.id}/${r.id}`]?.status === "pass",
          );
          return (
            <li key={`${r.voice}/${r.id}`} className={styles.item}>
              <div className={styles.itemHead}>
                <span className={styles.zh} lang="zh-CN">
                  {r.hanzi}
                </span>
                <span className={styles.py}>{r.pinyin}</span>
                <span className={styles.meta}>{w?.ja}</span>
                <span className={styles.meta}>声：{r.voice}</span>
                {pick !== null ? <span className={styles.tag}>take {pick} を使う（反映待ち）</span> : null}
              </div>
              <p className={styles.why}>{r.why}</p>
              <div className={styles.takes}>
                {takesOf(r.voice, r.id).map((take) => (
                  <div key={take} className={styles.take}>
                    <span>take {take}</span>
                    <audio controls preload="none" src={`/admin/take?voice=${r.voice}&id=${r.id}&take=${take}`} />
                    <form action={approveTake.bind(null, r.voice, r.id, take)}>
                      <button type="submit" className={`${styles.button} ${pick === take ? styles.primary : ""}`}>
                        {pick === take ? "使う（決めた）" : "これを使う"}
                      </button>
                    </form>
                  </div>
                ))}
                {others.length ? (
                  <div className={styles.take}>
                    <span className={styles.meta}>ほかの声：</span>
                    {others.map((v) => (
                      <span key={v.id} className={styles.take}>
                        <span className={styles.meta}>{v.id}</span>
                        <audio controls preload="none" src={`/audio/${v.id}/${r.id}.mp3`} />
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className={styles.take}>
                {pick !== null ? (
                  <form action={unapprove.bind(null, r.voice, r.id)}>
                    <button type="submit" className={styles.button}>
                      使うのをやめる
                    </button>
                  </form>
                ) : null}
                <form action={dismissClip.bind(null, r.voice, r.id)}>
                  <button type="submit" className={`${styles.button} ${styles.danger}`}>
                    どれも使わない
                  </button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>

      {setAside.length ? (
        <section className={styles.section}>
          <h2 className={styles.h2}>使わないことにした音声（{setAside.length}）</h2>
          <ul className={styles.items}>
            {setAside.map((r) => (
              <li key={`${r.voice}/${r.id}`} className={styles.pairRow}>
                <span className={styles.pairWords}>
                  <span className={styles.zh} lang="zh-CN">
                    {r.hanzi}
                  </span>
                  <span className={styles.py}>{r.pinyin}</span>
                  <span className={styles.meta}>{r.voice}</span>
                </span>
                <form action={undismiss.bind(null, r.voice, r.id)}>
                  <button type="submit" className={styles.button}>
                    もう一度聞く
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
