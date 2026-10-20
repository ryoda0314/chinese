/**
 * 学習の記録: the learner's whole record as one Markdown text to copy or save, opening with a request they can paste
 * into an AI of their choice (as in ことのあめ). The app makes no AI call for it. Pure.
 */
import type { FamilyData } from "./data.ts";
import { ja, type FamilyId } from "./i18n/ja.ts";
import { daysOf, saidByWord, type SaidLog } from "./log-core.ts";
import { ORDER, pairKey, type State } from "./rain-core.ts";

const RECENT_DAYS = 14;

const dateJa = (day: string) => {
  const [, m, d] = day.split("-").map(Number);
  return `${m}月${d}日`;
};
const dayOfMs = (ms: number) => new Date(ms + 9 * 3600_000).toISOString().slice(0, 10);

export function buildExport(state: State, families: Map<FamilyId, FamilyData>, now: number): string {
  const out: string[] = [];
  const word = (id: string) => {
    for (const f of families.values()) if (f.words[id]) return f.words[id];
    return null;
  };
  const face = (id: string) => {
    const w = word(id);
    return w ? `${w.hanzi} ${w.pinyin}` : id;
  };
  const pairFace = (key: string) => key.split("+").map(face).join(" ／ ");
  const verdictOf = (s: SaidLog) => {
    const name = (v: "word" | "partner") => word(v === "word" ? s.word : s.partner)?.hanzi ?? "";
    if (s.vowel !== undefined) return s.vowel ? `母音は「${name(s.vowel)}」に近い` : "母音はどちらとも言えない";
    if (s.nearer !== undefined)
      return s.nearer ? `声調の線は「${name(s.nearer)}」に近い` : "声調の線はどちらとも言えない";
    return "";
  };

  out.push(`# ことのね 学習の記録（${dateJa(dayOfMs(now))}）`, "");
  out.push(
    "以下は、中国語の声調とピンインを聞き分けて言えるようにするアプリ「ことのね」での、私の記録です。" +
      "ことのねでは、1か所だけ違う語の組（大学/大雪 など）を4つの声で聞き比べ、流れた語がどちらだったか選び、自分でも言ってみます。" +
      "この記録から、私がいまどの音の違いでつまずいていそうか、次に何を意識して聞いたり言ったりするとよいかを、やさしく教えてください。",
    "",
  );

  const bathed = ORDER.filter((id) => state.families[id]?.rains);
  const said = saidByWord(state.log);
  out.push("## これまで", "");
  out.push(`- 浴びた雨: ${state.rains}回`);
  out.push(`- 出会った違い: ${bathed.length}（${bathed.map((id) => ja.families[id].name).join("、") || "なし"}）`);
  out.push(`- 言ってみた語: ${said.length}`, "");

  if (bathed.length) {
    out.push("## 違いごと", "");
    for (const id of bathed) {
      const f = state.families[id]!;
      out.push(`### ${ja.families[id].name}（雨 ${f.rains}回）`, "");
      if (f.splitAt) out.push(`- 分かれて聞こえはじめた日: ${dateJa(dayOfMs(f.splitAt))}`);
      const data = families.get(id);
      const keys = data
        ? data.pairs.map(pairKey)
        : Object.keys(state.pairs).filter((k) => state.pairs[k].family === id);
      const met = keys.filter((k) => state.pairs[k]?.seen);
      const owed = met.filter((k) => state.pairs[k].owed);
      const before = met.filter((k) => !state.pairs[k].owed && state.pairs[k].missed);
      const clear = met.filter((k) => !state.pairs[k].missed);
      const line = (k: string) =>
        `${pairFace(k)}（会った ${state.pairs[k].seen}回・取り違えた ${state.pairs[k].missed}回）`;
      if (owed.length) out.push(`- いまも取り違えている組: ${owed.map(line).join("、")}`);
      if (before.length) out.push(`- 前は取り違えたが、その後は聞き分けた組: ${before.map(line).join("、")}`);
      out.push(`- 取り違えていない組: ${clear.length}組（会った組 ${met.length} / ${keys.length}）`, "");
    }
  }

  if (said.length) {
    out.push("## 言ってみた語（声の高さの線を、手本の4つの声と比べた結果）", "");
    for (const { word: id, attempts } of said) {
      const last = attempts[attempts.length - 1];
      const parts = [`${face(id)}（組の相手: ${face(last.partner)}）: ${attempts.length}回`];
      const v = verdictOf(last);
      if (v) parts.push(`最近は${v}`);
      if (attempts.length > 1) {
        const first = verdictOf(attempts[0]);
        if (first && first !== v) parts.push(`最初は${first}`);
      }
      if (last.heard) parts.push(`音声認識に聞こえた語: ${last.heard}`);
      out.push(`- ${parts.join("。")}`);
    }
    out.push("");
  }

  const days = daysOf(state.log).slice(0, RECENT_DAYS);
  if (days.length) {
    out.push(`## 日ごと（直近 ${days.length} 日）`, "");
    for (const d of days) {
      const rains = d.rains.map((r) =>
        r.times > 1 ? `${ja.families[r.family].name} ×${r.times}` : ja.families[r.family].name,
      );
      const missed = d.rains.flatMap((r) => r.missed).map(pairFace);
      const items = [`雨: ${rains.join("、") || "なし"}`];
      if (missed.length) items.push(`取り違えた組: ${missed.join("、")}`);
      if (d.said.length) items.push(`言ってみた: ${d.said.map((w) => word(w)?.hanzi ?? w).join("、")}`);
      out.push(`- ${dateJa(d.day)}: ${items.join(" / ")}`);
    }
    out.push("");
  }

  return out.join("\n");
}
