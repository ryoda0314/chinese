import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ja, type FamilyId } from "@/lib/i18n/ja";
import { ORDER } from "@/lib/rain-core";
import { FamilyLook } from "./FamilyLook";

export const metadata: Metadata = { title: ja.me.title };

export default async function FamilyPage({ params }: PageProps<"/app/me/d/[id]">) {
  const { id } = await params;
  if (!ORDER.includes(id as FamilyId)) notFound();
  return <FamilyLook id={id as FamilyId} />;
}
