"use client";

import { useActionState } from "react";
import { addPairAction, setMeaningAction, type FormResult } from "../actions";
import styles from "../admin.module.css";

/** 組を足す: checked on the server the way scripts/check-data.mjs checks the file (a real minimal pair of that difference). */
export function AddPairForm({ families }: { families: { id: string; name: string }[] }) {
  const [result, action, pending] = useActionState<FormResult | null, FormData>(addPairAction, null);
  return (
    <form action={action} className={styles.section}>
      <div className={styles.form}>
        <label>
          違い
          <select name="family" defaultValue={families[0]?.id}>
            {families.map((f) => (
              <option key={f.id} value={f.id}>
                {f.id} {f.name}
              </option>
            ))}
          </select>
        </label>
        {(["a", "b"] as const).map((k) => (
          <fieldset key={k} style={{ display: "contents" }}>
            <label>
              {k === "a" ? "1つ目" : "2つ目"} 漢字
              <input name={`${k}Hanzi`} required lang="zh-CN" />
            </label>
            <label>
              ピンイン（声調記号つき）
              <input name={`${k}Pinyin`} required placeholder="dà xué" />
            </label>
            <label>
              意味（初めての語だけ）
              <input name={`${k}Ja`} />
            </label>
          </fieldset>
        ))}
        <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={pending}>
          足す
        </button>
      </div>
      {result ? (
        <p className={styles.result} data-ok={String(result.ok)} role="status">
          {result.message}
        </p>
      ) : null}
    </form>
  );
}

/** 意味を直す: wherever data/pairs.txt writes the word's meaning. */
export function MeaningForm({ words }: { words: { key: string; label: string; ja: string }[] }) {
  const [result, action, pending] = useActionState<FormResult | null, FormData>(setMeaningAction, null);
  return (
    <form action={action} className={styles.section}>
      <div className={styles.form}>
        <label>
          語
          <select name="word">
            {words.map((w) => (
              <option key={w.key} value={w.key}>
                {w.label}（{w.ja}）
              </option>
            ))}
          </select>
        </label>
        <label>
          新しい意味
          <input name="ja" required />
        </label>
        <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={pending}>
          直す
        </button>
      </div>
      {result ? (
        <p className={styles.result} data-ok={String(result.ok)} role="status">
          {result.message}
        </p>
      ) : null}
    </form>
  );
}
