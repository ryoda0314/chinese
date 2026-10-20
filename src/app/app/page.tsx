import type { Metadata } from "next";
import { ja } from "@/lib/i18n/ja";
import { Rain } from "./_rain/Rain";

export const metadata: Metadata = { title: ja.nav.listen };

export default function ListenPage() {
  return <Rain />;
}
