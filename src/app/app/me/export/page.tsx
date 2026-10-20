import type { Metadata } from "next";
import { ja } from "@/lib/i18n/ja";
import { ExportView } from "./ExportView";

export const metadata: Metadata = { title: ja.me.export.title };

export default function ExportPage() {
  return <ExportView />;
}
