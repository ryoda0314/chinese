import Link from "next/link";
import { ja } from "@/lib/i18n/ja";
import styles from "./Logo.module.css";

const ICON_PX = { sm: 28, md: 34, lg: 72 } as const;

/** The mark (a line of pitch on five hairlines) and ことのね in mincho. `lg` stacks them, for the first screen. */
export function Logo({ size = "md", href = "/" }: { size?: keyof typeof ICON_PX; href?: string | null }) {
  const px = ICON_PX[size];
  const content = (
    <>
      <svg width={px} height={px} viewBox="0 0 64 64" className={styles.icon} aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="var(--paper)" stroke="var(--line)" />
        <path d="M10 16h44M10 24h44M10 32h44M10 40h44M10 48h44" stroke="var(--line-2)" strokeWidth="1.5" />
        <path d="M13 25c7 0 10 19 18 19s12-18 20-21" fill="none" stroke="var(--accent)" strokeWidth="4.5" strokeLinecap="round" />
      </svg>
      <span className={`wordmark-kana ${styles.word}`}>{ja.name}</span>
    </>
  );
  const className = `${styles.logo} ${styles[size]}`;
  return href ? (
    <Link href={href} className={className} aria-label={ja.name}>
      {content}
    </Link>
  ) : (
    <span className={className}>{content}</span>
  );
}
