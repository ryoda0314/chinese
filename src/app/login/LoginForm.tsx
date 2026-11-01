"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ja } from "@/lib/i18n/ja";
import { connectInProgress, finishConnect, startConnect } from "@/lib/connect";
import { account, signIn, signInWithKotonoame, signOut, type Account, type SignInResult } from "@/lib/sync";
import { GoogleButton } from "./GoogleButton";
import styles from "./login.module.css";

const t = ja.login;

/** Only paths inside this app, so a link cannot send someone elsewhere after signing in. */
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/app/me";
}

const never = () => () => {};

function message(reason: Exclude<SignInResult, { ok: true }>["reason"]): string {
  return t.errors[reason];
}

export function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [me, setMe] = useState<Account | null | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Back from ことのあめ with a token (connect.ts): "つないでいます" instead of the form. Read after hydration (the
  // server has no fragment), as useSyncExternalStore does with the server's value first.
  const connecting = useSyncExternalStore(never, connectInProgress, () => false);
  const [connectError, setConnectError] = useState("");

  useEffect(() => {
    let live = true;
    const returning = finishConnect(signInWithKotonoame);
    if (!returning) {
      void account().then((a) => {
        if (live) setMe(a);
      });
      return () => {
        live = false;
      };
    }
    void returning.then(async (result) => {
      if (!live) return;
      if (result.ok) {
        router.replace(safeNext(result.next));
        router.refresh();
        return;
      }
      setConnectError(result.reason === "stale" ? t.errors.connectStale : t.errors.connectFailed);
      setMe(await account());
    });
    return () => {
      live = false;
    };
  }, [router]);

  const done = () => {
    router.replace(next);
    router.refresh();
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const result = await signIn(email, password);
    setBusy(false);
    if (result.ok) done();
    else setError(message(result.reason));
  }

  if (me === undefined) return connecting ? <p className={styles.sent}>{t.connecting}</p> : <div className={styles.stack} />;

  if (me) {
    return (
      <div className={styles.stack}>
        <p className={styles.sent}>{t.already(me.email ?? "")}</p>
        <Link href={next} className="btn">
          {t.toApp}
        </Link>
        <button
          type="button"
          className="btn-quiet"
          onClick={async () => {
            await signOut();
            setMe(null);
          }}
        >
          {t.signOut}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      {connectError ? (
        <p className={styles.error} role="alert">
          {connectError}
        </p>
      ) : null}
      <button type="button" className="btn" onClick={() => startConnect(ja.kotonoame.url, next)}>
        {t.connect}
      </button>
      <p className={styles.small}>{t.connectNote}</p>
      <p className={styles.or}>{t.or}</p>
      <form onSubmit={submit} className={styles.stack}>
        <label htmlFor="email" className="label">
          {t.email}
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={styles.input}
        />
        <label htmlFor="password" className="label">
          {t.password}
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={styles.input}
        />
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn-quiet" disabled={busy}>
          {busy ? t.signingIn : t.submit}
        </button>
      </form>
      <GoogleButton onDone={done} onError={() => setError(t.errors.google)} />
      <p className={styles.small}>
        {t.noAccount}
        <a href={`${ja.kotonoame.url}/login/forgot`} className={styles.inlineLink}>
          {t.toKotonoame}
        </a>
      </p>
    </div>
  );
}
