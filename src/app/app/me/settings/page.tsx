import type { Metadata } from "next";
import { ja } from "@/lib/i18n/ja";
import { Settings } from "./Settings";

export const metadata: Metadata = { title: ja.me.settings.title };

export default function SettingsPage() {
  return <Settings />;
}
