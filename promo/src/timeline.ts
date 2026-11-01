// いつ何が起きるか（秒で決めて、コマにする）。ナレーションの長さはクリップの長さ（src/voice.json：scripts/voice.mjs が
// 書く）から、アプリの声と例文の声は src/clips.json（scripts/assets.mjs）から。中国語の声は、ナレーションと重ならない所で
// 鳴らす：声が言い終わってから、次のできごとへ進む。アプリの間合いは、アプリのとおり（../src/app/app/_rain/）：
//   聞き比べる  押すと組が降る。組ごとに 500 ms 待って a、380 ms、b、380 ms、450 ms。語を押すと降るのが止まる
//   聞き分ける  問いが出て 250 ms で語が鳴る。正解なら 1.6 秒で次の問いへ（12問目なら 違いのこと へ）
//   文の中で    出て 400 ms で1つ目の文が鳴る
//   言ってみる  声が止まって 700 ms で録音が止まる
// 画面は、押したときに変わる（アプリと同じ）。
//
// 見る人：中国語の声調やピンインを、知っていても聞き分けられない人。1か所だけ違う語の組をいくつもの声で浴び、
// 聞き分け、文の中で聞き、言ってみる。ある日ふいに分かれて聞こえてくる、を、アプリの画面で見せる。
import APP from "./app.json";
import CLIPS from "./clips.json";
import LINES from "../voice/lines.json";
import VOICE from "./voice.json";

/** 雨の6組（2声と3声）と、組ごとの声（Compare.tsx：組の順に、声の一覧を一つずつずらして）。 */
export const PAIRS = APP.rain.pairs;
export const VOICES = APP.voices.map((v) => v.id);
export const pairVoice = (i: number) => VOICES[i % VOICES.length];
/** 問いの声：アプリの紹介ページが 大学 と 大雪 の線を見せる声（2つの線の切れ目がいちばん少ない声：../src/app/page.tsx）。 */
export const HOOK_VOICE = "erinome";

type VoiceId = keyof typeof VOICE | (typeof LINES.lines)[number]["id"];
/** クリップの末尾の余白（声が消えてから残した 250ms と、足した 120ms）。次の声やできごとは、ここに重ねてよい。 */
const TAIL = 0.37;
/** まだ合成していない行は、字数から見積もる（作ったら実の長さに置き換わる）。 */
const length = (id: VoiceId) => (VOICE as Record<string, number>)[id] ?? [...(LINES.lines.find((l) => l.id === id)?.text ?? "")].length / 4.6 + TAIL;
const said = (id: VoiceId) => length(id) - TAIL;
/** ナレーションを置いた時（秒）。 */
const cues: { id: VoiceId; at: number }[] = [];
const say = (id: VoiceId, at: number) => {
  cues.push({ id, at });
  return at + said(id);
};

/** アプリの声・例文の声（<voice>/<id> か s1）を鳴らす時。長さは実の長さ。 */
const clips: { key: string; at: number }[] = [];
export const clipLength = (key: string) => (CLIPS as Record<string, number>)[key] ?? 1;
const play = (key: string, at: number) => {
  clips.push({ key, at });
  return at + clipLength(key);
};

function make() {
  // A. 問い：大学 と 大雪 が、アプリの声で。鳴るあいだに、その声の高さの線が描かれる。ほかの組（紹介ページと同じ3組）。
  const hook = { start: 0, cards: 0.3, a: 0.9, b: 0, ask: 0, more: 0, end: 0 };
  hook.b = play(`${HOOK_VOICE}/da4xue2-858b`, hook.a) + 0.35;
  const v01 = say("V01", play(`${HOOK_VOICE}/da4xue3-7c72`, hook.b) + 0.45);
  hook.ask = v01 - said("V01");
  const v02 = say("V02", v01 + 0.5);
  hook.more = v01 + 0.7;
  hook.end = v02 + 0.7;

  // B. ことのおと
  const title = { start: hook.end, icon: hook.end + 0.3, word: hook.end + 0.7, lead: hook.end + 1.5, end: 0 };
  title.end = say("V03", title.word - 0.05) + 0.5;

  // C1. 聞き比べる：押すと、組が一つずつ降る。2組目のあと（3組目が降る前の 450ms）に 大雪 を押すと、降るのが止まって
  //     6組が並び、大雪 が次の声で。ナレーション。もう一度押すと、また次の声で。下へ送って、聞き分けてみる。
  const compare = { start: title.end - 0.2, cap: 0, press: 0, pairs: [] as number[], tap1: 0, cap2: 0, tap2: 0, scroll: 0, toTell: 0 };
  compare.cap = compare.start + 0.4;
  const v04 = say("V04", compare.start + 0.5);
  compare.press = v04 - 0.4;
  let x = compare.press;
  for (const i of [0, 1]) {
    compare.pairs.push(x);
    const v = pairVoice(i);
    x = play(`${v}/${PAIRS[i].a}`, x + 0.5) + 0.38;
    x = play(`${v}/${PAIRS[i].b}`, x) + 0.38;
    x += 0.45;
  }
  compare.tap1 = x - 0.25;
  compare.cap2 = compare.tap1;
  // 1組目は 声の一覧の0番目（kore）で降った。押すたびに次の声：erinome、charon（Compare.tsx の say）。
  const v06 = say("V06", play(`${VOICES[1]}/${PAIRS[0].b}`, compare.tap1 + 0.05) + 0.35);
  compare.tap2 = v06 + 0.3;
  compare.scroll = play(`${VOICES[2]}/${PAIRS[0].b}`, compare.tap2 + 0.05) + 0.2;
  compare.toTell = compare.scroll + 0.95;

  // C2. 聞き分ける：1 / 12（糖 / 躺、躺 が流れる）を当てる。2 / 12（大学 / 大雪、大学 が流れる）を取り違える。
  //     こっちでした。両方を押して聞き比べ、次へ。
  const tell = { start: compare.toTell, cap: 0, q1: 0, pick1: 0, next1: 0, q2: 0, pick2: 0, cap2: 0, hearA: 0, hearB: 0, scroll: 0, next2: 0 };
  tell.cap = tell.start + 0.3;
  tell.q1 = tell.start + 0.25;
  const v07 = say("V07", play("kore/tang3-a854", tell.q1) + 0.35);
  // 選んでから 1.6 秒で次の問い、その 250ms 後に問いの語：ナレーションが言い終わってから鳴るように、言い終わりの近くで選ぶ。
  tell.pick1 = v07 - 1.6;
  tell.next1 = tell.pick1 + 1.6;
  tell.q2 = tell.next1 + 0.25;
  tell.pick2 = play("erinome/da4xue2-858b", tell.q2) + 0.75;
  tell.cap2 = tell.pick2 + 0.3;
  const v09 = say("V09", tell.pick2 + 0.5);
  tell.hearA = v09 + 0.3;
  tell.hearB = play("erinome/da4xue2-858b", tell.hearA + 0.05) + 0.4;
  // 次へ は線の下：少し下へ送ってから押す。
  tell.scroll = play("erinome/da4xue3-7c72", tell.hearB + 0.05) + 0.1;
  tell.next2 = tell.scroll + 0.75;

  // C3. 違いのこと（12問のあと：映像はそこまで飛ぶ）。違いの名前と作り方。取り違えた組は紫で、また降ってくる。
  const reveal = { start: tell.next2, cap: 0, cap2: 0, toLines: 0 };
  reveal.cap = reveal.start + 0.3;
  const v10 = say("V10", reveal.start + 0.6);
  reveal.cap2 = v10 + 0.15;
  const v11 = say("V11", v10 + 0.35);
  reveal.toLines = v11 + 0.35;

  // C4. 文の中で：ことのあめ の例文。出て 400ms で1つ目が例文の声で流れる。訳を見る。
  const lines = { start: reveal.toLines, cap: 0, play: 0, translate: 0, toSay: 0 };
  lines.cap = lines.start + 0.3;
  lines.play = lines.start + 0.4;
  const v12 = say("V12", play("s1", lines.play) + 0.35);
  lines.translate = v12 - 1.1;
  lines.toSay = v12 + 0.7;

  // C5. 言ってみる：大学。手本を聞いて、言ってみる。声が止まって 700ms で録音が止まり、線を描いて、手本の線に重なる。
  //     線がどちらに近いか、何に聞こえたか（scripts/say.mjs：アプリと同じ処理で出したもの）。
  const sayIt = { start: lines.toSay, cap: 0, model: 0, rec: 0, voice: 0, analysing: 0, result: 0, heard: 0, end: 0 };
  sayIt.cap = sayIt.start + 0.3;
  const v13 = say("V13", sayIt.start + 0.5);
  sayIt.model = v13 + 0.3;
  sayIt.rec = play("kore/da4xue2-858b", sayIt.model + 0.05) + 0.55;
  sayIt.voice = sayIt.rec + 0.6;
  sayIt.analysing = play("iapetus/da4xue2-858b", sayIt.voice) + 0.7;
  sayIt.result = sayIt.analysing + 0.45;
  sayIt.heard = sayIt.result + 0.9;
  sayIt.end = sayIt.heard + 2.1;

  // C6. 数日後：同じ 2声と3声 の雨の、12問目。雨 が流れて、すぐに分かる。1.6 秒で 違いのこと：分かれて聞こえています。
  //     自分 の 違いごと に、その日。
  const later = { start: sayIt.end, cap: 0, q: 0, pick: 0, reveal: 0, toMe: 0, cap2: 0, end: 0 };
  later.cap = later.start + 0.3;
  later.q = later.start + 0.65;
  later.pick = play("iapetus/yu3-8995", later.q) + 0.5;
  const v15 = say("V15", later.pick + 0.45);
  later.reveal = later.pick + 1.6;
  later.toMe = v15 - 0.15;
  later.cap2 = later.toMe + 0.1;
  const v16 = say("V16", v15 + 0.45);
  later.end = v16 + 1.2;

  // D. 終わり
  const end = { start: later.end, icon: later.end + 0.3, word: later.end + 0.7, lead: later.end + 1.4, rest: later.end + 2.1, end: 0 };
  end.end = Math.max(end.start + 5.8, say("V17", end.word + 0.05) + 1.6);

  return { hook, title, compare, tell, reveal, lines, sayIt, later, end };
}

const S = make();
type Times = Record<string, number | number[]>;
const frames = <T extends Times>(o: T) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v.map((s) => Math.round(s * 30)) : Math.round(v * 30)])) as {
    [K in keyof T]: T[K] extends number[] ? number[] : number;
  };

export const T = {
  hook: frames(S.hook),
  title: frames(S.title),
  compare: frames(S.compare),
  tell: frames(S.tell),
  reveal: frames(S.reveal),
  lines: frames(S.lines),
  say: frames(S.sayIt),
  later: frames(S.later),
  end: frames(S.end),
};

export const TOTAL = Math.round(S.end.end * 30);

/** ナレーション：クリップと、鳴らしはじめるコマ・声が消えるコマ（音楽はこの間だけ下がる）。 */
export const VOICE_AT = cues.map((c) => ({ id: c.id, from: Math.round(c.at * 30), until: Math.round((c.at + said(c.id)) * 30) }));

/** アプリの声と例文の声：鳴らすものと、鳴らすコマ・鳴り終わるコマ。 */
export const CLIP_AT = clips.map((c) => ({ key: c.key, from: Math.round(c.at * 30), until: Math.round((c.at + clipLength(c.key)) * 30) }));

/** `key`（<voice>/<id>、s1）が `frame` に鳴っていれば、鳴りはじめてからのコマ（なければ -1）。 */
export function sounding(frame: number, key: string): number {
  for (const c of CLIP_AT) if (c.key === key && frame >= c.from && frame < c.until) return frame - c.from;
  return -1;
}

/** 語（id）が `frame` に、どの声ででも鳴っていれば、鳴りはじめてからのコマ（なければ -1）。`after`：このコマより後に鳴りはじめたものだけ。 */
export function wordSounding(frame: number, id: string, after = -Infinity): number {
  for (const c of CLIP_AT) if (c.key.endsWith(`/${id}`) && c.from >= after && frame >= c.from && frame < c.until) return frame - c.from;
  return -1;
}

/** 音楽の区切り（秒）。scripts/music.py に渡す。 */
export const MUSIC_MARKS = { title: S.title.start, story: S.compare.start, later: S.later.start, end: S.end.start, total: S.end.end };
