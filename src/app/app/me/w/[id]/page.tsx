import type { Metadata } from "next";
import { ja } from "@/lib/i18n/ja";
import { WordLook } from "./WordLook";

export const metadata: Metadata = { title: ja.me.title };

export default async function WordPage({ params }: PageProps<"/app/me/w/[id]">) {
  const { id } = await params;
  return <WordLook id={id} />;
}
