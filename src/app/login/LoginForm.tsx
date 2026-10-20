"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ja } from "@/lib/i18n/ja";
import { account, signIn, signOut, type Account, type SignInResult } from "@/lib/sync";
import { GoogleButton } from "./GoogleButton";
import styles from "./login.module.css";

const t = ja.login;

/** Only paths inside this app, so a link cannot send someone elsewhere after signing in. */
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/app/me";
}

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

  useEffect(() => {
    void account().then(setMe);
  }, []);

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

  if (me === undefined) return <div className={styles.stack} />;

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
        <button type="submit" className="btn" disabled={busy}>
          {busy ? t.signingIn : t.submit}
        </button>
      </form>
      <GoogleButton onDone={done} onError={() => setError(t.errors.google)} />
      <p className={styles.small}>
        {t.noAccount}
        <a href={`${ja.kotonoame.url}/login`} className={styles.inlineLink}>
          {t.toKotonoame}
        </a>
      </p>
    </div>
  );
}
