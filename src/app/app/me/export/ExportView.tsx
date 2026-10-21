"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { buildExport } from "@/lib/export";
import { ja } from "@/lib/i18n/ja";
import { saidByWord } from "@/lib/log-core";
import { ORDER } from "@/lib/rain-core";
import { useFamilies, useRecord } from "../useRecord";
import styles from "../me.module.css";

const t = ja.me.export;

/** 学習の記録: the whole record as one text, shown here only, to copy or save and paste into an AI of one's choice. */
export function ExportView() {
  const { state } = useRecord();
  const [copied, setCopied] = useState<"" | "ok" | "failed">("");
  const [now] = useState(() => Date.now());
  const ids = state
    ? [...ORDER.filter((id) => state.families[id]?.rains), ...saidByWord(state.log).map((s) => s.attempts[0].family)]
    : [];
  const { families } = useFamilies(ids);

  const back = (
    <Link href="/app/me" className={styles.back}>
      <Icon name="back" size={18} />
      {ja.me.title}
    </Link>
  );
  if (!state) return <div className={styles.page}>{back}</div>;
  const text = buildExport(state, families, now);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("ok");
    } catch {
      setCopied("failed");
    }
  }

  function save() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `kotonooto-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.page}>
      {back}
      <h1 className={styles.h2}>{t.title}</h1>
      <p className={styles.lead}>{t.lead}</p>
      <div className={styles.actions}>
        <button type="button" className="btn" onClick={copy}>
          {copied === "ok" ? t.copied : t.copy}
        </button>
        <button type="button" className="btn-quiet" onClick={save}>
          {t.save}
        </button>
      </div>
      {copied === "failed" ? <p className={styles.note}>{t.copyFailed}</p> : null}
      <textarea className={styles.exportText} readOnly value={text} aria-label={t.title} />
      <p className={styles.note}>{t.note}</p>
    </div>
  );
}
