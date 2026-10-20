"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import styles from "./BottomNav.module.css";

/** The two tabs: a bar at the bottom on a phone, a column down the left on a wide screen, with the name above. */
export function BottomNav({ labels, brand }: { labels: { listen: string; me: string; label: string }; brand?: ReactNode }) {
  const pathname = usePathname();
  const items = [
    { href: "/app", label: labels.listen, icon: "shower" as const, active: pathname === "/app" },
    { href: "/app/me", label: labels.me, icon: "user" as const, active: pathname.startsWith("/app/me") },
  ];
  return (
    <nav className={styles.nav} aria-label={labels.label}>
      {brand ? <div className={styles.brand}>{brand}</div> : null}
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={item.active ? `${styles.item} ${styles.active}` : styles.item}
          aria-current={item.active ? "page" : undefined}
        >
          <Icon name={item.icon} size={22} />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
