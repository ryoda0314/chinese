// C. アプリの画面で、ひとめぐり。左に映像の言葉、右にアプリ（電話の幅 560 px を 1.4 倍で）。
//   聞き比べる：押すと組が降る（大学/大雪 を kore、埋/买 を erinome で）。大雪 を押すと降るのが止まって6組が並び、
//               大雪 が erinome で。もう一度押すと charon で。下へ送って、聞き分けてみる。
//   聞き分ける：1 / 12 糖/躺（kore の 躺）を当てる。2 / 12 大学/大雪（erinome の 大学）を 大雪 と取り違え、
//               両方を押して聞き比べて、次へ。
//   違いのこと：2声と3声。取り違えた 大学/大雪 は紫で、また降ってくる。
//   文の中で：ことのあめ の例文。出て 400ms で「我姐也是大学生。」が流れる。訳を見る。
//   言ってみる：大学。手本（kore）を聞いて言ってみる。線が手本の線に重なり、線は「大学」に近い、聞こえた語 大学 通じた
//               （学習者の声の代わりにアプリ自身の iapetus の声。線も判定も聞こえた語も scripts/say.mjs がアプリと同じ処理で出したもの）。
//   数日後：同じ違いの雨の 12 / 12。雨（iapetus）をすぐに当てて、1.6 秒で 違いのこと：分かれて聞こえています。
//   自分：違いごと に、分かれて聞こえはじめた日（記録は例：scripts/assets.mjs の EXAMPLE）。
import type { CSSProperties, ReactNode } from "react";
import { Easing } from "remotion";
import APP from "../app.json";
import SAY from "../say.json";
import { fall, prog, SOFT } from "../anim";
import { PAIRS, sounding, T, wordSounding } from "../timeline";
import { C, FONT } from "../theme";
import { BottomNav, Btn, hint, Icon, lead, Legend, PitchLines, Press, Ripple, Steps, WordFace, type Word } from "../ui";
import { Captions, type Cap } from "./Caption";

const R = APP.copy.rain;
const STEP = APP.copy.steps;
const ME = APP.copy.me;
const FAMILY = APP.copy.family;
const W = APP.rain.words as unknown as Record<string, Word>;
type Voice = "kore" | "erinome" | "charon" | "iapetus";

/** 映像の言葉。 */
const CAPS: Cap[] = [
  { from: T.compare.cap, door: "compare", main: [["1か所だけ違う語の組が、"], ["いくつもの声で降ってくる。"]], sub: [["男女4つの声。組ごとに、声が変わる。"]] },
  { from: T.compare.cap2, door: "compare", main: [["語を押すと、"], ["別の声で、もう一度。"]], sub: [["降るのが止まって、6組が並ぶ。"]] },
  { from: T.tell.cap, door: "tell", main: [["ひとつ流れて、"], ["どっちだったか選ぶ。"]], sub: [["答え合わせは、すぐ。"], ["2つの語の高さが、線で並ぶ。"]] },
  { from: T.tell.cap2, door: "tell", main: [["間違えても、"], ["点数はつけない。"]], sub: [["両方を、何度でも聞き比べる。"], ["数えるのは、いま何問目かだけ。"]] },
  { from: T.reveal.cap, door: "tell", main: [["違いの名前は、"], ["聞き分けたあとで。"]], sub: [["表や理屈からは入らない。"]] },
  { from: T.reveal.cap2, door: "again", main: [["取り違えた組は、"], ["また降ってくる。"]], sub: [["日をあけて、また雨の中で。"], ["復習を強いることはしない。"]] },
  { from: T.lines.cap, door: "lines", main: [["同じ語が、"], ["ふだんの文の中で。"]], sub: [["姉妹アプリ ことのあめ の例文を、その音声で。"], ["どこにいるか、耳で探す。"]] },
  { from: T.say.cap, door: "say", main: [["言ってみると、"], ["声の高さが線になる。"]], sub: [["手本の線に重なって、"], ["何に聞こえたかも返ってくる。"]] },
  { from: T.later.cap, door: "later", main: [["何度も直されるうちに、"], ["ある日、ふいに。"]], sub: [["別の音として、聞こえてくる。"]] },
  { from: T.later.cap2, door: "me", main: [["その日が、"], ["記録に残る。"]], sub: [["点数ではなく、分かれて聞こえはじめた日。"], ["ほかの人とは比べない。"]] },
];

const PANEL = { left: 1016, top: 40, width: 784, height: 1000 };
const K = 1.4;
const PW = PANEL.width / K;
const PH = PANEL.height / K;
/** 下のタブの高さ（BottomNav：4 + 50 + 8 px と罫）。ページはこの上で切れる。 */
const NAV = 63;
/** 聞き比べるの6組とボタンは画面に入りきらない：大雪 を押したあと、下へ送る（ボタンの下に 20px 残る所まで）。 */
const COMPARE_SCROLL = 372;
/** 聞き分けるで取り違えたあと、線の下の 次へ が見える所まで送る。 */
const TELL_SCROLL = 86;

const actions: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" };
const zhT: CSSProperties = { fontFamily: FONT.zh, color: C.ink };
/** 結果が出るとき（rain.module.css の settle：0.4 秒、下から 8px）。 */
const settle = (frame: number, at: number): CSSProperties => {
  const p = prog(frame, at, 12, Easing.bezier(0, 0, 0.58, 1));
  return { opacity: p, transform: `translateY(${(1 - p) * 8}px)` };
};
/** 下へ送る（指で送ったように、0.5 秒ほど）。 */
const scrolled = (frame: number, at: number, by: number) => by * prog(frame, at, 16, SOFT);

export function Story({ frame }: { frame: number }) {
  return (
    <>
      <Captions frame={frame} caps={CAPS} until={T.end.start} />
      <Panel frame={frame} />
    </>
  );
}

// ---- 画面の入れ替わり ------------------------------------------------------------------------------------------------

/**
 * 画面と、出てくるコマ。押して変わる所（press）は、アプリと同じくすぐに：6 コマで重ねて入れ替える。時が飛ぶ所（12問のあと、
 * 数日後：dip）は、いったん紙に戻してから次の画面。
 */
const SCREENS: { from: number; cut: "press" | "dip"; Screen: (p: { frame: number }) => ReactNode }[] = [
  { from: T.compare.start, cut: "press", Screen: CompareScreen },
  { from: T.tell.start, cut: "press", Screen: TellScreen },
  { from: T.reveal.start, cut: "dip", Screen: RevealScreen },
  { from: T.lines.start, cut: "press", Screen: LinesScreen },
  { from: T.say.start, cut: "press", Screen: SayScreen },
  { from: T.later.start, cut: "dip", Screen: LaterTellScreen },
  { from: T.later.reveal, cut: "press", Screen: LaterRevealScreen },
  { from: T.later.toMe, cut: "press", Screen: MeScreen },
];
const PRESS_FADE = 6;
const DIP_OUT = 8;
const DIP_IN = 10;

function Panel({ frame }: { frame: number }) {
  let cur = 0;
  SCREENS.forEach((s, i) => {
    if (frame >= s.from) cur = i;
  });
  const now = SCREENS[cur];
  const before = cur > 0 ? SCREENS[cur - 1] : null;
  // 新しい画面の濃さと、前の画面の濃さ（重ねるときは前を下に敷いたまま）。
  const dip = now.cut === "dip";
  const p = cur === 0 ? 1 : dip ? prog(frame, now.from + DIP_OUT - 2, DIP_IN, SOFT) : prog(frame, now.from, PRESS_FADE, SOFT);
  const q = dip ? 1 - prog(frame, now.from, DIP_OUT, SOFT) : 1;
  return (
    <div style={{ position: "absolute", ...PANEL, borderRadius: 28, border: `1.5px solid ${C.line2}`, overflow: "hidden", background: C.paper, ...fall(frame, T.compare.start, 24, 18) }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: PW, height: PH, transform: `scale(${K})`, transformOrigin: "0 0", fontFamily: FONT.ui, color: C.ink, lineHeight: 1.6 }}>
        {p < 1 && before && q > 0 ? (
          <div style={{ position: "absolute", inset: 0, background: C.paper, opacity: q }}>
            <before.Screen frame={frame} />
          </div>
        ) : null}
        <div style={{ position: "absolute", inset: 0, opacity: p, background: C.paper }}>
          <now.Screen frame={frame} />
        </div>
        <BottomNav active={frame >= T.later.toMe ? "me" : "listen"} />
        {/* 自分 のタブを押す */}
        <div style={{ position: "absolute", left: 0, top: 0, width: PW, height: PH, zIndex: 9, pointerEvents: "none" }}>
          <Press t={frame - T.later.toMe} x={PW / 2 + (PW - 16) / 4} y={PH - NAV + 29} size={52} />
        </div>
      </div>
    </div>
  );
}

/** 画面の中身（rain.module.css の .page：上 16・左右 20・下 40、間 24。自分 は上 32、間 20）。 */
function Page({ children, scroll = 0, me = false }: { children: ReactNode; scroll?: number; me?: boolean }) {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: NAV, overflow: "hidden" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: me ? 20 : 24, padding: me ? "32px 20px 40px" : "16px 20px 40px", transform: scroll ? `translateY(${-scroll}px)` : undefined }}>
        {children}
      </div>
    </div>
  );
}

/** 雨の終わりの「次の雨」（rain.module.css の .end：縦に並ぶので、ボタンは幅いっぱい）。言ってみるでは目立つほう。 */
function NextRain({ primary = false }: { primary?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 16, borderTop: `1px solid ${C.line}` }}>
      <Btn quiet={!primary}>{R.nextRain}</Btn>
    </div>
  );
}

// ---- 聞き比べる -------------------------------------------------------------------------------------------------------

function CompareScreen({ frame }: { frame: number }) {
  const t = T.compare;
  // 押してから 3 コマ、押した姿を見せてから降りはじめる。
  const started = frame >= t.press + 3;
  const done = frame >= t.tap1;
  const shownAt = (i: number) => (i < t.pairs.length ? t.pairs[i] + 3 : t.tap1);
  return (
    <Page scroll={scrolled(frame, t.scroll, COMPARE_SCROLL)}>
      <Steps at={0} />
      <p style={lead}>{R.compareLead}</p>
      {!started ? (
        <>
          <div style={actions}>
            <Btn press={frame - t.press}>
              <Icon name="speaker" />
              {STEP.compare}
            </Btn>
          </div>
          <p style={hint}>{R.soundOn}</p>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", borderTop: `1px solid ${C.line}` }}>
          {PAIRS.map((p, i) =>
            frame >= shownAt(i) ? (
              <div key={p.a} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: `1px solid ${C.line}`, ...fall(frame, shownAt(i), 28, 21) }}>
                {[p.a, p.b].map((id, k) => (
                  <span
                    key={id}
                    style={{
                      position: "relative",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 2,
                      minHeight: 92,
                      padding: "14px 12px 12px",
                      background: wordSounding(frame, id) >= 0 ? C.tint : "transparent",
                      borderLeft: k ? `1px solid ${C.line}` : undefined,
                    }}
                  >
                    <WordFace word={W[id]} />
                    {i === 0 && k === 1 ? (
                      <>
                        <Press t={frame - t.tap1} size={64} />
                        <Press t={frame - t.tap2} size={64} />
                      </>
                    ) : null}
                  </span>
                ))}
              </div>
            ) : null,
          )}
        </div>
      )}
      {done ? (
        <>
          <p style={hint}>{R.tapToHear}</p>
          <div style={actions}>
            <Btn press={frame - t.toTell}>{R.toTell}</Btn>
            <Btn quiet>
              <Icon name="replay" />
              {R.replayAll}
            </Btn>
          </div>
        </>
      ) : null}
    </Page>
  );
}

// ---- 聞き分ける -------------------------------------------------------------------------------------------------------

type Trial = { a: string; b: string; answer: "a" | "b"; voice: Voice; n: string };

/**
 * 問い一つ（Tell.tsx）。`q`：問いの語が鳴っていれば、鳴りはじめてからのコマ。`picked`：選んだ側（まだなら null）。
 * `presses`：押したコマ（a・b）。`next`：次へ を押すコマ。
 */
function Question({
  frame,
  trial,
  q,
  picked,
  pickAt,
  presses,
  next = -99,
  scroll = 0,
  id,
}: {
  frame: number;
  trial: Trial;
  q: number;
  picked: "a" | "b" | null;
  pickAt: number;
  presses: { a: number[]; b: number[] };
  next?: number;
  scroll?: number;
  id: string;
}) {
  const words = { a: W[trial.a], b: W[trial.b] };
  const right = picked !== null && picked === trial.answer;
  const answer = words[trial.answer];
  const other = words[trial.answer === "a" ? "b" : "a"];
  const stateOf = (side: "a" | "b") => (!picked ? undefined : side === trial.answer ? "right" : side === picked ? "picked" : "dim");
  return (
    <Page scroll={scroll}>
      <Steps at={1} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <p style={lead}>{R.tellLead}</p>
        <span style={{ fontFamily: FONT.en, fontSize: 13, color: C.faint, letterSpacing: "0.04em" }}>{trial.n}</span>
      </div>
      <span
        style={{
          position: "relative",
          alignSelf: "center",
          width: 88,
          height: 88,
          borderRadius: "50%",
          border: `1px solid ${C.accent}`,
          background: C.accent,
          color: "#fff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="speaker" size={34} />
        <Ripple t={q} />
      </span>
      <p style={{ alignSelf: "center", margin: "-8px 0 0", fontSize: 13, color: C.muted }}>{R.hearAgain}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {(["a", "b"] as const).map((side) => {
          const st = stateOf(side);
          return (
            <span
              key={side}
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                minHeight: 120,
                padding: "16px 8px",
                border: `1.5px ${st === "picked" ? "dashed" : "solid"} ${st === "right" ? C.accent : C.line2}`,
                borderRadius: 12,
                background: st === "right" ? C.tint : C.paper,
              }}
            >
              <WordFace word={words[side]} size={34} state={st} />
              {presses[side].map((at) => (
                <Press key={at} t={frame - at} size={70} />
              ))}
            </span>
          );
        })}
      </div>
      {picked ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 0 0", borderTop: `1px solid ${C.line}`, ...settle(frame, pickAt) }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: right ? C.accent : C.ink }}>{right ? R.heardRight : R.heardWrong}</p>
          <PitchLines
            id={id}
            lines={[
              { line: other.lines[trial.voice], kind: "other" },
              { line: answer.lines[trial.voice], kind: "answer" },
            ]}
          />
          <Legend
            items={[
              {
                kind: "answer",
                label: (
                  <>
                    <span style={zhT}>{answer.hanzi}</span> {answer.pinyin}
                  </>
                ),
              },
              {
                kind: "other",
                label: (
                  <>
                    <span style={zhT}>{other.hanzi}</span> {other.pinyin}
                  </>
                ),
              },
            ]}
          />
          <div style={actions}>
            <Btn quiet={right} press={frame - next}>
              {R.next}
              <Icon name="arrow" size={18} />
            </Btn>
          </div>
        </div>
      ) : null}
    </Page>
  );
}

// 1 / 12：糖 と 躺、kore の 躺。2 / 12：大学 と 大雪、erinome の 大学。（問いの順と声は、アプリでは雨ごとに混ぜて決まる）
const FIRST: Trial = { a: PAIRS[2].a, b: PAIRS[2].b, answer: "b", voice: "kore", n: R.trial1 };
const SECOND: Trial = { a: PAIRS[0].a, b: PAIRS[0].b, answer: "a", voice: "erinome", n: R.trial2 };

function TellScreen({ frame }: { frame: number }) {
  const t = T.tell;
  if (frame < t.next1) {
    return (
      <Question
        frame={frame}
        trial={FIRST}
        id="tell1"
        q={sounding(frame, `${FIRST.voice}/${FIRST.b}`)}
        picked={frame >= t.pick1 ? "b" : null}
        pickAt={t.pick1}
        presses={{ a: [], b: [t.pick1] }}
      />
    );
  }
  // 取り違えたあとに 大学 を押して鳴る声は、問いの声と同じ（Tell.tsx の voiceFor）：輪は問いのときだけ。
  return (
    <Question
      frame={frame}
      trial={SECOND}
      id="tell2"
      q={frame < t.pick2 ? sounding(frame, `${SECOND.voice}/${SECOND.a}`) : -1}
      picked={frame >= t.pick2 ? "b" : null}
      pickAt={t.pick2}
      presses={{ a: [t.hearA], b: [t.pick2, t.hearB] }}
      next={t.next2}
      scroll={scrolled(frame, t.scroll, TELL_SCROLL)}
    />
  );
}

// ---- 違いのこと -------------------------------------------------------------------------------------------------------

function RevealSection({ split = false }: { split?: boolean }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 16, borderTop: `1.5px solid ${C.ink}` }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.muted }}>{R.revealTitle}</p>
      <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, lineHeight: 1.6 }}>{FAMILY.name}</h2>
      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.8, color: C.ink2 }}>{FAMILY.hint}</p>
      {split ? <p style={{ margin: 0, padding: "12px 14px", borderLeft: `3px solid ${C.again}`, background: C.againTint, fontSize: 15 }}>{R.splitNow}</p> : null}
    </section>
  );
}

function RevealScreen({ frame }: { frame: number }) {
  const t = T.reveal;
  const [a, b] = [W[PAIRS[0].a], W[PAIRS[0].b]];
  const py: CSSProperties = { fontFamily: FONT.en, fontSize: 13, marginLeft: 4 };
  return (
    <Page>
      <Steps at={1} />
      <RevealSection />
      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={hint}>{R.comesBack}</p>
        <p style={{ margin: 0, fontFamily: FONT.zh, fontSize: 18, color: C.again }}>
          {a.hanzi}
          <span style={py}>{a.pinyin}</span>
          {" ／ "}
          {b.hanzi}
          <span style={py}>{b.pinyin}</span>
        </p>
      </section>
      <div style={actions}>
        <Btn press={frame - t.toLines}>{R.toSentences}</Btn>
      </div>
      <NextRain />
    </Page>
  );
}

// ---- 文の中で ---------------------------------------------------------------------------------------------------------

type Sentence = (typeof APP.sentences)[number];
const HAN = /\p{Script=Han}/u;

/** 一つの文：字ごとにピンイン、語は灯る（Sentences.tsx の Ruby）。 */
function Ruby({ s, length }: { s: Sentence; length: number }) {
  const syllables = s.pinyin.trim().split(/\s+/);
  let k = 0;
  return (
    <p style={{ margin: 0, fontFamily: FONT.zh, fontSize: 21, lineHeight: 2.2 }}>
      {[...s.zh].map((ch, i) => {
        if (!HAN.test(ch)) return <span key={i}>{ch}</span>;
        const index = k++;
        const lit = index >= s.at && index < s.at + length;
        return (
          <ruby key={i} style={{ color: lit ? C.accent : undefined }}>
            {ch}
            <rt style={{ fontFamily: FONT.en, fontSize: "0.5em", fontWeight: 400, color: C.muted, letterSpacing: 0 }}>{syllables[index]}</rt>
          </ruby>
        );
      })}
    </p>
  );
}

function LinesScreen({ frame }: { frame: number }) {
  const t = T.lines;
  const playing = sounding(frame, "s1") >= 0;
  return (
    <Page>
      <Steps at={2} />
      <p style={lead}>{R.sentencesLead}</p>
      <div style={{ display: "flex", flexDirection: "column", borderTop: `1px solid ${C.line}` }}>
        {APP.sentences.map((s, i) => {
          const on = i === 0 && playing;
          return (
            <div key={s.zh} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "16px 0", borderBottom: `1px solid ${C.line}`, ...fall(frame, t.start + Math.round(i * 7.5), 28, 21) }}>
              <span
                style={{
                  flexShrink: 0,
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: `1px solid ${on ? C.accent : C.line2}`,
                  background: C.paper,
                  color: on ? C.accent : C.ink,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="speaker" />
              </span>
              <div>
                <Ruby s={s} length={[...W[s.word].hanzi].length} />
                <div style={{ position: "relative" }}>
                  {i === 0 && frame >= t.translate ? (
                    <p style={{ margin: "4px 0 0", fontSize: 14, color: C.muted }}>{s.ja}</p>
                  ) : (
                    <span style={{ fontSize: 13, color: C.accent, textDecoration: "underline", textUnderlineOffset: "0.25em" }}>{R.showTranslation}</span>
                  )}
                  {i === 0 ? <Press t={frame - t.translate} x={26} y={11} size={40} /> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={actions}>
        <Btn press={frame - t.toSay}>{R.toSay}</Btn>
      </div>
      <NextRain />
    </Page>
  );
}

// ---- 言ってみる -------------------------------------------------------------------------------------------------------

function SayCard({ word, children }: { word: Word; children?: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: 16, border: `1px solid ${C.line2}`, borderRadius: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "4px 12px" }}>
        <WordFace word={word} />
      </div>
      {children}
    </div>
  );
}

function SayScreen({ frame }: { frame: number }) {
  const t = T.say;
  const word = W[SAY.word];
  const partner = W[SAY.partner];
  const phase = frame < t.rec ? "idle" : frame < t.analysing ? "listening" : frame < t.result ? "analysing" : "done";
  const busy = phase === "listening" || phase === "analysing";
  // 録音中の輪：声の大きさ（say.json の levels：代わりの声のコマごとの大きさ）。声の前とあとは静か。
  const k = frame - t.voice;
  const level = k >= 0 && k < SAY.levels.length ? SAY.levels[k] : 0;
  // 学習者の線は、出たとき 0.6 秒の ease-out で描かれる（PitchLines.module.css：線の長さより長い 2000 の破線をずらす）。
  const own = Math.min(1, (prog(frame, t.result, 18, Easing.bezier(0, 0, 0.58, 1)) * 2000) / 560);
  const voice = SAY.voice as Voice;
  return (
    <Page>
      <Steps at={3} />
      <p style={lead}>{R.sayLead}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <SayCard word={word}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn quiet disabled={busy} press={frame - t.model}>
              <Icon name="speaker" />
              {R.modelLine}
            </Btn>
            <Btn disabled={busy} press={frame - t.rec} ring={phase === "listening" ? 0.25 + level * 0.75 : undefined}>
              <Icon name="mic" />
              {phase === "listening" ? R.recording : phase === "analysing" ? R.analysing : R.record}
            </Btn>
          </div>
          {phase === "done" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, ...settle(frame, t.result) }}>
              <PitchLines
                id="say"
                lines={[
                  { line: partner.lines[voice], kind: "other" },
                  { line: word.lines[voice], kind: "model" },
                  { line: SAY.line, kind: "own", draw: own },
                ]}
              />
              <Legend
                items={[
                  { kind: "own", label: R.yourLine },
                  {
                    kind: "model",
                    label: (
                      <>
                        {R.modelLine} <span style={zhT}>{word.hanzi}</span>
                      </>
                    ),
                  },
                  {
                    kind: "other",
                    label: (
                      <>
                        <span style={zhT}>{partner.hanzi}</span> {partner.pinyin}
                      </>
                    ),
                  },
                ]}
              />
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: SAY.nearer === "word" ? C.accent : C.ink }}>{R.nearerDaxue}</p>
              <p style={{ margin: 0, fontSize: 14, color: C.muted }}>
                {R.heard}：
                {frame < t.heard ? (
                  "…"
                ) : (
                  <span style={settle(frame, t.heard)}>
                    <span style={{ ...zhT, fontSize: 17 }}>{SAY.heard.text}</span> {SAY.heard.pinyin}
                    {SAY.heard.text === word.hanzi ? <span style={{ marginLeft: 10, color: C.accent, fontWeight: 600 }}>{R.through}</span> : null}
                  </span>
                )}
              </p>
            </div>
          ) : null}
        </SayCard>
        {/* 2つ目：取り違えなかった組から（Say.tsx の wordsToSay：2つ目は組の b）。録音はカードごと：こちらは押せるまま。 */}
        <SayCard word={W[PAIRS[1].b]}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn quiet>
              <Icon name="speaker" />
              {R.modelLine}
            </Btn>
            <Btn>
              <Icon name="mic" />
              {R.record}
            </Btn>
          </div>
        </SayCard>
      </div>
      <NextRain primary />
    </Page>
  );
}

// ---- 数日後 -----------------------------------------------------------------------------------------------------------

// 同じ違い（2声と3声）の雨の、最後の問い：鱼 と 雨、iapetus の 雨。
const LAST: Trial = { a: PAIRS[3].a, b: PAIRS[3].b, answer: "b", voice: "iapetus", n: R.trial12 };

function LaterTellScreen({ frame }: { frame: number }) {
  const t = T.later;
  return (
    <Question
      frame={frame}
      trial={LAST}
      id="later"
      q={sounding(frame, `${LAST.voice}/${LAST.b}`)}
      picked={frame >= t.pick ? "b" : null}
      pickAt={t.pick}
      presses={{ a: [], b: [t.pick] }}
    />
  );
}

function LaterRevealScreen() {
  return (
    <Page>
      <Steps at={1} />
      <RevealSection split />
      <div style={actions}>
        <Btn>{R.toSentences}</Btn>
      </div>
      <NextRain />
    </Page>
  );
}

// ---- 自分 -------------------------------------------------------------------------------------------------------------

function MeScreen() {
  const ex = ME.example;
  const stats: [string, number, string][] = [
    [ME.stats.rains, ex.rains, ME.statUnits.rains],
    [ME.stats.families, ex.families, ME.statUnits.families],
    [ME.stats.said, ex.said, ME.statUnits.said],
  ];
  return (
    <Page me>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.6 }}>{ME.title}</h1>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: C.muted }}>{ME.lead}</p>
      <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
        {ME.localShort} <span style={{ color: C.accent, textDecoration: "underline", textUnderlineOffset: "0.25em" }}>{ME.connect}</span>
      </p>
      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 style={{ margin: 0, paddingTop: 16, borderTop: `1.5px solid ${C.ink}`, fontSize: 17, fontWeight: 600, lineHeight: 1.6 }}>{ME.sofar}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", margin: "4px 0 0" }}>
          {stats.map(([dt, dd, unit], i) => (
            <div key={dt} style={{ padding: i ? "4px 0 4px 12px" : "4px 0", borderLeft: i ? `1px solid ${C.line}` : undefined }}>
              <div style={{ fontSize: 12, color: C.muted }}>{dt}</div>
              <div style={{ margin: "2px 0 0", fontFamily: FONT.en, fontSize: 26, fontWeight: 500 }}>
                {dd}
                {unit ? <span style={{ marginLeft: 2, fontFamily: FONT.ui, fontSize: 13, color: C.muted }}>{unit}</span> : null}
              </div>
            </div>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: C.faint }}>{ME.sofarNote}</p>
      </section>
      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* 振り返りかたは前に選んだもの（違いごと）が残っている（Me.tsx：端末に覚えておく）。 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", borderBottom: `1px solid ${C.line}`, marginTop: 12 }}>
          {(["days", "families", "said"] as const).map((v) => (
            <span
              key={v}
              style={{
                minHeight: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
                color: v === "families" ? C.ink : C.muted,
                fontWeight: v === "families" ? 600 : 400,
                borderBottom: `2px solid ${v === "families" ? C.ink : "transparent"}`,
                marginBottom: -1,
              }}
            >
              {ME.views[v]}
            </span>
          ))}
        </div>
        <div>
          {ex.rows.map((r) => (
            <div key={r.id} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "14px 0", borderBottom: `1px solid ${C.line}` }}>
              <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: 16, fontWeight: 500 }}>{r.name}</span>
                <span style={{ fontSize: 13, color: C.muted }}>{r.meta}</span>
              </span>
              {"split" in r && r.split ? <span style={{ fontSize: 14, color: C.accent }}>{r.split}</span> : null}
              {"owed" in r && r.owed ? <span style={{ fontSize: 13, color: C.again }}>{r.owed}</span> : null}
            </div>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: C.faint }}>{ex.notYet}</p>
      </section>
    </Page>
  );
}
