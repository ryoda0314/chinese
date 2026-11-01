// A. 問い：大学 と 大雪。アプリの声（紹介ページが線を見せる声）で一つずつ鳴り、鳴るあいだに、その声の高さの線が描かれる
// （アプリのデータの線：同じ声のクリップから測ったもの。大学 はアクセント、大雪 は墨：紹介ページと同じ）。
// 違いが、聞こえますか？ 日本語では区別しない違い：紹介ページと同じ3組（大学/大雪、肚子/兔子、人民/人名）。
import { Easing } from "remotion";
import APP from "../app.json";
import { fall, leave, prog } from "../anim";
import { CLIP_AT, HOOK_VOICE, T } from "../timeline";
import { C, FONT } from "../theme";
import { PitchLines } from "../ui";

const [DAXUE, ...MORE] = APP.hook;

/** 語が鳴るあいだに線を描く：鳴りはじめから、声の消える所（クリップの末尾 0.3 秒の手前）まで。 */
function drawn(frame: number, id: string) {
  const c = CLIP_AT.find((x) => x.key === `${HOOK_VOICE}/${id}`);
  if (!c) return 1;
  return prog(frame, c.from, c.until - c.from - 9, Easing.linear);
}
const playing = (frame: number, id: string) => CLIP_AT.some((c) => c.key === `${HOOK_VOICE}/${id}` && frame >= c.from && frame < c.until && c.from < T.title.start);

const caption = { position: "absolute", left: 0, right: 0, margin: 0, textAlign: "center", fontFamily: FONT.ui, fontWeight: 600, color: C.ink } as const;

function Card({ frame, w, x, dash, at }: { frame: number; w: (typeof DAXUE)["a"]; x: number; dash: string; at: number }) {
  const on = playing(frame, w.id);
  return (
    <div style={{ position: "absolute", left: x, top: 110, width: 520, ...fall(frame, at, 26, 18) }}>
      <div
        style={{
          height: 330,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          border: `2px solid ${on ? C.accent : C.line2}`,
          borderRadius: 26,
          background: on ? C.tint : C.paper,
        }}
      >
        <span style={{ fontFamily: FONT.zh, fontSize: 150, lineHeight: 1.15, letterSpacing: "0.02em", color: C.ink }}>{w.hanzi}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 18, fontFamily: FONT.en, fontSize: 46, color: C.ink2 }}>
          <span style={{ width: 46, height: 7, borderRadius: 4, background: dash }} />
          {w.pinyin}
        </span>
      </div>
    </div>
  );
}

export function Hook({ frame }: { frame: number }) {
  const h = T.hook;
  const { a, b } = DAXUE;
  return (
    <>
      {/* 大学 と 大雪：鳴って、線が描かれる。違いが、聞こえますか？ */}
      {frame < h.more + 12 ? (
        <div style={frame >= h.more ? leave(frame, h.more, 12) : undefined}>
          <Card frame={frame} w={a} x={410} dash={C.accent} at={h.cards} />
          <Card frame={frame} w={b} x={990} dash={C.ink} at={h.cards + 5} />
          <div style={{ position: "absolute", left: 410, top: 500, width: 1100, ...fall(frame, h.cards + 10, 16, 18) }}>
            <PitchLines
              id="hook"
              height={250}
              scale={2.2}
              lines={[
                { line: a.lines[HOOK_VOICE as keyof typeof a.lines], kind: "answer", draw: drawn(frame, a.id) },
                { line: b.lines[HOOK_VOICE as keyof typeof b.lines], kind: "model", draw: drawn(frame, b.id) },
              ]}
            />
          </div>
          <p style={{ ...caption, top: 820, fontSize: 60, ...fall(frame, h.ask, 14, 18) }}>違いが、聞こえますか？</p>
        </div>
      ) : null}

      {/* 日本語では区別しない違い（前のものが消えてから降る） */}
      {frame >= h.more + 12 ? (
        <>
          <div style={{ position: "absolute", left: 360, top: 120, width: 1200, borderTop: `1.5px solid ${C.line}` }}>
            {[DAXUE, ...MORE].map((p, i) => (
              <div key={p.a.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: `1.5px solid ${C.line}`, ...fall(frame, h.more + 12 + i * 7, 28, 21) }}>
                {[p.a, p.b].map((w, k) => (
                  <span key={w.id} style={{ display: "flex", alignItems: "baseline", gap: 26, padding: "26px 44px", borderLeft: k ? `1.5px solid ${C.line}` : undefined }}>
                    <span style={{ fontFamily: FONT.zh, fontSize: 92, lineHeight: 1.25, letterSpacing: "0.02em" }}>{w.hanzi}</span>
                    <span style={{ fontFamily: FONT.en, fontSize: 40, color: C.ink2 }}>{w.pinyin}</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
          <div style={{ ...fall(frame, h.more + 26, 14, 18) }}>
            <p style={{ ...caption, top: 720, fontSize: 56, lineHeight: 1.45 }}>
              日本語では区別しない違い。
              <br />
              知っていても、最初は同じに聞こえる。
            </p>
          </div>
        </>
      ) : null}
    </>
  );
}
