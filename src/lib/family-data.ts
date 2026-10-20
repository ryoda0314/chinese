"use client";

// The public data (public/data, built by scripts/build-data.mjs), fetched once per page load and shared.
import type { FamilyData, Index } from "./data.ts";
import type { FamilyId } from "./i18n/ja.ts";

let index: Promise<Index> | null = null;
const families = new Map<string, Promise<FamilyData>>();

export function getIndex(): Promise<Index> {
  index ??= fetch("/data/index.json", { cache: "no-cache" })
    .then((r) => r.json() as Promise<Index>)
    .catch((err) => {
      index = null;
      throw err;
    });
  return index;
}

export async function getFamily(id: FamilyId): Promise<FamilyData> {
  const { version } = await getIndex();
  let f = families.get(id);
  if (!f) {
    f = fetch(`/data/f/${id}.json?v=${version}`).then((r) => r.json() as Promise<FamilyData>);
    f.catch(() => families.delete(id));
    families.set(id, f);
  }
  return f;
}

/** The differences asked for that exist in the data, by id; whatever cannot be fetched is left out. */
export async function getFamilies(ids: FamilyId[]): Promise<Map<FamilyId, FamilyData>> {
  try {
    const ix = await getIndex();
    const wanted = [...new Set(ids)].filter((id) => ix.families.some((f) => f.id === id));
    const list = await Promise.all(wanted.map((id) => getFamily(id).catch(() => null)));
    return new Map(list.filter((f): f is FamilyData => f !== null).map((f) => [f.id, f]));
  } catch {
    return new Map();
  }
}
