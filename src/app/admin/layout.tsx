import type { Metadata } from "next";
import Link from "next/link";
import { assertDev } from "@/lib/admin";
import styles from "./admin.module.css";

export const metadata: Metadata = { title: "管理", robots: { index: false } };

/** The maker's side: only under `npm run dev`, on the machine that has the raw takes. */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  assertDev();
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <p className={styles.title}>
          <span className="wordmark-kana">ことのおと</span> 管理
        </p>
        <nav className={styles.nav}>
          <Link href="/admin">概要</Link>
          <Link href="/admin/audio">確認待ちの音声</Link>
          <Link href="/admin/pairs">語の組</Link>
          <Link href="/app">アプリ</Link>
        </nav>
        <p className={styles.note}>
          この PC で npm run dev のときだけ開きます。変更はこのリポジトリのファイルに書かれます。
        </p>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
