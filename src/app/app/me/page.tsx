import type { Metadata } from "next";
import { ja } from "@/lib/i18n/ja";
import { Me } from "./Me";

export const metadata: Metadata = { title: ja.me.title };

export default function MePage() {
  return <Me />;
}
