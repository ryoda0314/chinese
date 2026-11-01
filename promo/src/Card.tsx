// 一目でわかる紹介画像（npm run card、1920×1080）：名前と一行、それに三つの所——聞き比べる（1か所だけ違う組を4つの声で）、
// 聞き分ける（どっちだったか、すぐ答え合わせ）、言ってみる（声の高さの線が手本に重なる）。線と語はアプリのデータ。
import { AbsoluteFill, Img, staticFile } from "remotion";
import APP from "./app.json";
import SAY from "./say.json";
import { C, FONT, useFonts } from "./theme";
import { PitchLines, WordFace, type Word } from "./ui";

const W = APP.rain.words as unknown as Record<string, Word>;
const [XUE2, XUE3] = [W["da4xue2-858b"], W["da4xue3-7c72"]];
type Voice = "kore" | "erinome" | "charon" | "iapetus";

function Point({ n, title, body, children }: { n: string; title: string; body: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, padding: "34px 34px 30px", border: `1.5px solid ${C.line2}`, borderRadius: 24, background: C.paper, minWidth: 0 }}>
      <div style={{ height: 250, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 600, color: C.accent }}>{n}</p>
      <p style={{ margin: 0, fontSize: 36, fontWeight: 600, lineHeight: 1.35, wordBreak: "auto-phrase", textWrap: "pretty" }}>{title}</p>
      <p style={{ margin: 0, fontSize: 24, lineHeight: 1.7, color: C.ink2, wordBreak: "auto-phrase", textWrap: "pretty" }}>{body}</p>
    </div>
  );
}

export function Card() {
  useFonts();
  const voice = SAY.voice as Voice;
  return (
    <AbsoluteFill lang="ja" style={{ background: C.paper, color: C.ink, fontFamily: FONT.ui, padding: "70px 90px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
        <Img src={staticFile("app/icon.png")} style={{ width: 120, height: 120 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontFamily: FONT.mincho, fontWeight: 700, fontSize: 76, letterSpacing: "0.06em", lineHeight: 1.1 }}>{APP.copy.name}</span>
          <span style={{ fontSize: 36, fontWeight: 600 }}>{APP.copy.intro.lead}</span>
        </div>
      </div>
      <div style={{ marginTop: 56, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 36 }}>
        <Point n={APP.copy.steps.compare} title="1か所だけ違う組が降る" body="男女4つの声で、組ごとに声を変えて。語を押すと、別の声でもう一度。">
          <div style={{ width: "100%", borderTop: `1px solid ${C.line}`, zoom: 1.1 }}>
            {APP.rain.pairs.slice(0, 2).map((p) => (
              <div key={p.a} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: `1px solid ${C.line}` }}>
                {[p.a, p.b].map((id, k) => (
                  <span key={id} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, padding: "12px 12px 10px", borderLeft: k ? `1px solid ${C.line}` : undefined }}>
                    <WordFace word={W[id]} />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </Point>
        <Point n={APP.copy.steps.tell} title="答え合わせは、すぐ" body="流れたのはどっち？ 点数はつけない。取り違えた組は、日をあけてまた降ってくる。">
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[XUE2, XUE3].map((w, i) => (
                <span
                  key={w.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    padding: "14px 8px",
                    border: `1.5px solid ${i === 0 ? C.accent : C.line2}`,
                    borderRadius: 12,
                    background: i === 0 ? C.tint : C.paper,
                  }}
                >
                  <WordFace word={w} size={40} state={i === 0 ? "right" : "dim"} />
                </span>
              ))}
            </div>
            <PitchLines
              id="card-tell"
              height={84}
              scale={1.3}
              lines={[
                { line: XUE3.lines.erinome, kind: "other" },
                { line: XUE2.lines.erinome, kind: "answer" },
              ]}
            />
          </div>
        </Point>
        <Point n={APP.copy.steps.say} title="声の高さが、線になる" body="手本の線に重なって、何に聞こえたかも返ってくる。録音は残さない。">
          <div style={{ width: "100%" }}>
            <PitchLines
              id="card-say"
              height={200}
              scale={1.6}
              lines={[
                { line: XUE3.lines[voice], kind: "other" },
                { line: XUE2.lines[voice], kind: "model" },
                { line: SAY.line, kind: "own" },
              ]}
            />
          </div>
        </Point>
      </div>
      <p style={{ position: "absolute", left: 90, bottom: 56, margin: 0, fontSize: 24, color: C.muted }}>
        {APP.copy.intro.note}例文と音声は、姉妹アプリ ことのあめ から。
      </p>
    </AbsoluteFill>
  );
}
