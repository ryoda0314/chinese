import { BottomNav } from "@/components/BottomNav";
import { Logo } from "@/components/Logo";
import { ja } from "@/lib/i18n/ja";
import { CountOpen } from "./CountOpen";
import styles from "./app.module.css";

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className={styles.shell}>
      <CountOpen />
      <main className={styles.main}>{children}</main>
      <BottomNav labels={ja.nav} brand={<Logo size="sm" href="/" />} />
    </div>
  );
}
