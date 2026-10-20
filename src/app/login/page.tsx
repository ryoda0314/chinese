import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { ja } from "@/lib/i18n/ja";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";

export const metadata: Metadata = { title: ja.login.title };

/** ことのあめのアカウントでつなぐ: optional; the app works without it, on the device only. */
export default function LoginPage() {
  return (
    <div className={styles.page}>
      <Logo href="/" />
      <section className={styles.card}>
        <h1 className={styles.h1}>{ja.login.title}</h1>
        <p className={styles.lead}>{ja.login.lead}</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </section>
      <p className={styles.small}>{ja.login.note}</p>
    </div>
  );
}
