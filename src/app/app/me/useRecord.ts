"use client";

import { useCallback, useEffect, useState } from "react";
import type { FamilyData, Index } from "@/lib/data";
import { getFamilies, getIndex } from "@/lib/family-data";
import type { FamilyId } from "@/lib/i18n/ja";
import type { State } from "@/lib/rain-core";
import { loadState, saveState } from "@/lib/store";
import { account, syncRecord, type Account } from "@/lib/sync";

/**
 * The learner's record for the 自分 pages: the device's at once, then merged with the account's when signed in.
 * `update` keeps a change (and the account's copy follows, as everywhere).
 */
export function useRecord() {
  const [state, setState] = useState<State | null>(null);
  const [me, setMe] = useState<Account | null | undefined>(undefined);

  useEffect(() => {
    void account().then(setMe);
    const local = loadState();
    const first = window.setTimeout(() => setState(local), 0);
    void syncRecord().then(setState);
    return () => window.clearTimeout(first);
  }, []);

  const update = useCallback((next: State) => {
    saveState(next);
    setState(next);
  }, []);

  return { state, setState, me, setMe, update };
}

/** The data of these differences (names, words, lines), as it arrives. */
export function useFamilies(ids: FamilyId[]): { families: Map<FamilyId, FamilyData>; index: Index | null } {
  const [families, setFamilies] = useState<Map<FamilyId, FamilyData>>(new Map());
  const [index, setIndex] = useState<Index | null>(null);
  const key = [...new Set(ids)].sort().join(",");
  useEffect(() => {
    let live = true;
    void getIndex()
      .then((ix) => live && setIndex(ix))
      .catch(() => undefined);
    void getFamilies(key ? (key.split(",") as FamilyId[]) : []).then((m) => live && setFamilies(m));
    return () => {
      live = false;
    };
  }, [key]);
  return { families, index };
}

/** A word wherever it is in the loaded differences. */
export function findWord(families: Map<FamilyId, FamilyData>, id: string) {
  for (const f of families.values()) if (f.words[id]) return f.words[id];
  return null;
}

/** 今日, きのう, or 10月18日（土）, in Japan time. */
export function dayLabel(
  day: string,
  today: string,
  yesterday: string,
  labels: { today: string; yesterday: string },
): string {
  if (day === today) return labels.today;
  if (day === yesterday) return labels.yesterday;
  const date = new Date(`${day}T00:00:00+09:00`);
  return date.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Tokyo" });
}
