"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { ja } from "@/lib/i18n/ja";
import { forgetSaid } from "@/lib/log-core";
import { loadState } from "@/lib/store";
import { resetRecord, signOut } from "@/lib/sync";
import { useRecord } from "../useRecord";
import styles from "../me.module.css";

const t = ja.me.settings;

/** 記録とアカウント: where the record is kept, what is in it, and letting go of it. */
export function Settings() {
  const { state, setState, me, setMe, update } = useRecord();
  const [done, setDone] = useState(false);

  const back = (
    <Link href="/app/me" className={styles.back}>
      <Icon name="back" size={18} />
      {ja.me.title}
    </Link>
  );
  if (!state || me === undefined) return <div className={styles.page}>{back}</div>;
  const lines = state.log?.said.length ?? 0;

  return (
    <div className={styles.page}>
      {back}
      <h1 className={styles.h2}>{t.title}</h1>

      <section className={styles.box}>
        <h2 className={styles.boxTitle}>{t.account}</h2>
        {me ? (
          <>
            <p className={styles.linked}>{t.linked(me.email ?? "")}</p>
            <p className={styles.lead}>{t.linkedLead}</p>
            <button
              type="button"
              className={styles.textButton}
              onClick={async () => {
                await signOut();
                setMe(null);
              }}
            >
              {t.unlink}
            </button>
          </>
        ) : (
          <>
            <p className={styles.lead}>{t.linkLead}</p>
            <Link href="/login?next=/app/me/settings" className="btn-quiet">
              {t.link}
            </Link>
          </>
        )}
      </section>

      <section className={styles.box}>
        <h2 className={styles.boxTitle}>{t.record}</h2>
        <p className={styles.lead}>{t.size(state.log?.rains.length ?? 0, lines)}</p>
        {state.rains ? (
          <Link href="/app/me/export" className={styles.inlineLink}>
            {ja.me.exportLink}
          </Link>
        ) : null}
        {lines ? (
          <button
            type="button"
            className={styles.danger}
            onClick={() => {
              if (window.confirm(t.forgetLinesConfirm)) {
                update({ ...state, log: forgetSaid(state.log) });
                setDone(true);
              }
            }}
          >
            {t.forgetLines}
          </button>
        ) : null}
        <button
          type="button"
          className={styles.danger}
          onClick={async () => {
            if (window.confirm(me ? t.resetLinkedConfirm : t.resetConfirm)) {
              await resetRecord();
              setState(loadState());
              setDone(true);
            }
          }}
        >
          {me ? t.resetLinked : t.reset}
        </button>
        {done ? (
          <p className={styles.done} role="status">
            {t.done}
          </p>
        ) : null}
      </section>
    </div>
  );
}
