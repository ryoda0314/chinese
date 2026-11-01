// ことのおと の画面を、映像のために描き直したもの（../src/**/*.module.css、../src/app/globals.css）。大きさはアプリの px
// のまま、画面は CSS の拡大で大きく見せる。ひとりでには動かない：どの変化もコマで決まる。
import type { CSSProperties, ReactNode } from "react";
import { Img, staticFile } from "remotion";
import { C, FONT } from "./theme";

// ---- アイコン（../src/components/Icon.tsx） ----------------------------------------------------------------------

const PATHS = {
  speaker: (
    <>
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21" />
    </>
  ),
  pair: (
    <>
      <rect x="3" y="6" width="8" height="12" rx="2" />
      <rect x="13" y="6" width="8" height="12" rx="2" />
    </>
  ),
  ear: (
    <>
      <path d="M7 9.5a5 5 0 0 1 10 0c0 3.2-3 4-3 6.8a3 3 0 0 1-5.6 1.4" />
      <path d="M10 10a2 2 0 0 1 4 0c0 1.6-1.6 2-1.6 3.4" />
    </>
  ),
  lines: <path d="M4 7h16M4 12h16M4 17h10" />,
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  replay: (
    <>
      <path d="M4 12a8 8 0 1 0 2.5-5.8" />
      <path d="M4 4v4.5h4.5" />
    </>
  ),
  shower: (
    <>
      <path d="M7 13.5h10a3.5 3.5 0 0 0 .2-7A5 5 0 0 0 7.7 7.6 3 3 0 0 0 7 13.5z" />
      <path d="M9 17v2.5" />
      <path d="M12 16.5v4" />
      <path d="M15 17v2.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  ),
};
export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, color = "currentColor", stroke = 1.8 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0 }}>
      {PATHS[name]}
    </svg>
  );
}

export const rgba = (hex: string, a: number) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",")},${a})`;

// ---- 小さな部品 ------------------------------------------------------------------------------------------------------

/** 指で押したところ：輪が寄って、離れる。`t` は押してからのコマ（前なら負）。 */
export function Press({ t, x = "50%", y = "50%", size = 46 }: { t: number; x?: number | string; y?: number | string; size?: number }) {
  if (t < -8 || t > 16) return null;
  const inP = Math.min(1, (t + 8) / 8);
  const outP = t > 0 ? Math.min(1, t / 16) : 0;
  return (
    <span
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: "50%",
        background: rgba(C.ink, 0.14 * inP * (1 - outP)),
        border: `2px solid ${rgba(C.ink, 0.32 * inP * (1 - outP))}`,
        transform: `scale(${1.25 - 0.25 * inP + 0.5 * outP})`,
        pointerEvents: "none",
        zIndex: 5,
      }}
    />
  );
}

/** 鳴っている間、ボタンから広がる波紋（rain.module.css の .listen[data-playing]：1.6 秒、0.8 秒ずらして二重）。 */
export function Ripple({ t, color = C.accent }: { t: number; color?: string }) {
  if (t < 0) return null;
  return (
    <>
      {[0, 24].map((d) => {
        if (t < d) return null;
        const p = ((((t - d) % 48) + 48) % 48) / 48;
        return (
          <span
            key={d}
            style={{ position: "absolute", inset: -1, borderRadius: "50%", border: `1.5px solid ${color}`, opacity: 0.55 * (1 - p), transform: `scale(${1 + 0.7 * p})` }}
          />
        );
      })}
    </>
  );
}

/**
 * ボタン（globals.css の .btn / .btn-quiet）。`disabled`：.btn は薄く、.btn-quiet は字が faint に。
 * `ring`：録音中の輪の濃さ（rain.module.css の .record[data-on]::after、opacity は --level）。
 */
export function Btn({
  children,
  quiet = false,
  press = -99,
  disabled = false,
  ring,
  style,
}: {
  children: ReactNode;
  quiet?: boolean;
  press?: number;
  disabled?: boolean;
  ring?: number;
  style?: CSSProperties;
}) {
  const pressed = press >= 0 && press < 6;
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minHeight: 52,
        padding: quiet ? "0 20px" : "0 24px",
        borderRadius: 12,
        border: `1px solid ${quiet ? C.line2 : C.accent}`,
        background: quiet ? C.paper : C.accent,
        color: quiet ? (disabled ? C.faint : C.ink) : "#fff",
        opacity: disabled && !quiet ? 0.55 : 1,
        fontSize: quiet ? 15 : 16,
        fontWeight: quiet ? 500 : 600,
        lineHeight: 1.6,
        fontFamily: FONT.ui,
        transform: pressed ? "scale(0.97)" : undefined,
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
      {ring !== undefined ? (
        <span style={{ position: "absolute", inset: -3, borderRadius: 15, border: `2px solid ${C.accent}`, opacity: ring, pointerEvents: "none" }} />
      ) : null}
      <Press t={press} />
    </span>
  );
}

export const lead: CSSProperties = { margin: 0, fontSize: 15, lineHeight: 1.75, color: C.muted, fontFamily: FONT.ui };
export const hint: CSSProperties = { margin: 0, fontSize: 13, color: C.faint, fontFamily: FONT.ui };

// ---- 雨の流れ（_rain/Steps.tsx・steps.module.css） ----------------------------------------------------------------

export const STEPS: { icon: IconName; label: string }[] = [
  { icon: "pair", label: "聞き比べる" },
  { icon: "ear", label: "聞き分ける" },
  { icon: "lines", label: "文の中で" },
  { icon: "mic", label: "言ってみる" },
];

/** 済んだ所は印、いまの所は灯り、先は薄く。数えるものではなく、道しるべ。 */
export function Steps({ at }: { at: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${STEPS.length}, minmax(0, 1fr))`, padding: "4px 0 16px", borderBottom: `1px solid ${C.line}` }}>
      {STEPS.map((s, i) => {
        const state = i < at ? "done" : i === at ? "now" : "next";
        return (
          <div key={s.label} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 0 }}>
            {i > 0 ? <span style={{ position: "absolute", top: 19, right: "50%", width: "100%", height: 2, background: i <= at ? C.accent : C.line2 }} /> : null}
            <span
              style={{
                position: "relative",
                zIndex: 1,
                width: 40,
                height: 40,
                borderRadius: "50%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: `2px solid ${state === "next" ? C.line2 : C.accent}`,
                background: state === "done" ? C.accent : state === "now" ? C.tint : C.paper,
                color: state === "done" ? "#fff" : state === "now" ? C.accent : C.faint,
                outline: state === "now" ? `4px solid ${C.tint}` : undefined,
                outlineOffset: 2,
              }}
            >
              <Icon name={state === "done" ? "check" : s.icon} size={20} />
            </span>
            <span
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 4,
                fontSize: 12,
                lineHeight: 1.3,
                whiteSpace: "nowrap",
                color: state === "done" ? C.ink2 : state === "now" ? C.accent : C.faint,
                fontWeight: state === "now" ? 600 : 400,
              }}
            >
              <span style={{ fontFamily: FONT.en, fontSize: 11 }}>{i + 1}</span>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** 下のタブ（components/BottomNav.tsx）：聞く・自分。 */
export function BottomNav({ active }: { active: "listen" | "me" }) {
  const items: [typeof active, IconName, string][] = [
    ["listen", "shower", "聞く"],
    ["me", "user", "自分"],
  ];
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        background: C.paper,
        borderTop: `1px solid ${C.line}`,
        padding: "4px 8px 8px",
        zIndex: 8,
      }}
    >
      {items.map(([id, icon, name]) => (
        <span
          key={id}
          style={{
            minHeight: 50,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            fontSize: 11,
            color: id === active ? C.accent : C.muted,
            fontWeight: id === active ? 600 : 400,
            fontFamily: FONT.ui,
          }}
        >
          <Icon name={icon} size={22} />
          {name}
        </span>
      ))}
    </div>
  );
}

/** アイコンと、明朝の ことのおと（components/Logo.tsx）。 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <Img src={staticFile("app/icon.png")} style={{ width: size, height: size }} />
      <span style={{ fontFamily: FONT.mincho, fontWeight: 700, fontSize: size * 0.6, letterSpacing: "0.06em", lineHeight: 1.2 }}>ことのおと</span>
    </span>
  );
}

// ---- 語（_rain/WordFace.tsx）：漢字、声調記号つきのピンイン、意味 ----------------------------------------------------

export type Word = { id: string; hanzi: string; pinyin: string; ja: string; lines: Record<string, (number | null)[]> };

/**
 * `state`：聞き分けるの選んだあと（rain.module.css の .choice[data-state]）。right は漢字とピンインがアクセント、
 * picked と dim は漢字が薄く（ピンインは ink-2 のまま）。`again`：また降ってきた語（紫）。
 */
export function WordFace({ word, size = 30, state, again = false }: { word: Word; size?: number; state?: "right" | "picked" | "dim"; again?: boolean }) {
  const hanzi = again ? C.again : state === "right" ? C.accent : state ? C.muted : C.ink;
  return (
    <>
      <span style={{ fontFamily: FONT.zh, fontSize: size, lineHeight: 1.25, letterSpacing: "0.02em", color: hanzi }}>{word.hanzi}</span>
      <span style={{ fontFamily: FONT.en, fontSize: 16, lineHeight: 1.6, color: state === "right" ? C.accent : C.ink2 }}>{word.pinyin}</span>
      <span style={{ fontSize: 12, lineHeight: 1.6, color: C.muted, fontFamily: FONT.ui }}>{word.ja}</span>
    </>
  );
}

// ---- 高さの線（components/PitchLines.tsx・PitchLines.module.css） -------------------------------------------------

const W = 320;
const H = 120;
const PAD_X = 10;
// 5 の上と 1 の下に少し余白：4声は1声より高く始まることが多く、3声は底より沈む。
const TOP = 5.8;
const BOTTOM = 0.5;
const ly = (level: number) => ((TOP - Math.max(BOTTOM, Math.min(TOP, level))) / (TOP - BOTTOM)) * H;

/** 線を、声の無い所で切って描く。 */
function linePath(line: (number | null)[]): string {
  const n = line.length;
  let d = "";
  let open = false;
  line.forEach((v, k) => {
    if (v === null) {
      open = false;
      return;
    }
    const x = PAD_X + (n > 1 ? k / (n - 1) : 0.5) * (W - 2 * PAD_X);
    d += `${open ? "L" : "M"}${x.toFixed(1)} ${ly(v).toFixed(1)}`;
    open = true;
  });
  return d;
}

/**
 * model：手本（墨）。own：学習者の声（アクセント）。other：組の相手（薄く点線）。answer：聞き分けるの正解。
 * `draw`：0 → 1 で左から描かれる（アプリでは学習者の線だけが 0.6 秒で描かれる。ほかは出たときから全部）。
 */
export type DrawnLine = { line: (number | null)[]; kind: "model" | "own" | "other" | "answer"; draw?: number };
const ORDER = { other: 0, model: 2, answer: 3, own: 4 } as const;
const STROKE: Record<DrawnLine["kind"], { color: string; width: number; dash?: string }> = {
  model: { color: C.ink, width: 2.25 },
  answer: { color: C.accent, width: 2.75 },
  own: { color: C.accent, width: 3 },
  other: { color: C.faint, width: 1.75, dash: "5 5" },
};

/** 5本の細い罫の上に、高さの線（下が低く、上が高い。数字は出さない）。`scale`：線の太さの倍率（大きく見せるとき）。 */
export function PitchLines({ lines, id, height = 96, scale = 1 }: { lines: DrawnLine[]; id: string; height?: number; scale?: number }) {
  const sorted = [...lines].sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block", width: "100%", height, overflow: "visible" }}>
      <defs>
        {sorted.map((l, i) => (
          <clipPath key={i} id={`${id}-${i}`}>
            <rect x={-10} y={-40} width={(W + 20) * (l.draw ?? 1)} height={H + 80} />
          </clipPath>
        ))}
      </defs>
      {[1, 2, 3, 4, 5].map((level) => (
        <line key={level} x1={0} x2={W} y1={ly(level)} y2={ly(level)} stroke={C.line} strokeWidth={Math.max(1, scale * 0.7)} vectorEffect="non-scaling-stroke" />
      ))}
      {sorted.map((l, i) =>
        (l.draw ?? 1) > 0 ? (
          <path
            key={i}
            d={linePath(l.line)}
            clipPath={`url(#${id}-${i})`}
            fill="none"
            stroke={STROKE[l.kind].color}
            strokeWidth={STROKE[l.kind].width * scale}
            strokeDasharray={STROKE[l.kind].dash?.split(" ").map((n) => Number(n) * scale).join(" ")}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null,
      )}
    </svg>
  );
}

/** 線の見本（rain.module.css の .legend）：色の短い線と、何の線か。 */
export function Legend({ items }: { items: { kind: "answer" | "model" | "own" | "other"; label: ReactNode }[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", fontSize: 13, color: C.muted, fontFamily: FONT.ui }}>
      {items.map((it, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 18,
              height: 0,
              borderTop: it.kind === "other" ? `2px dashed ${C.faint}` : `3px solid ${it.kind === "model" ? C.ink : C.accent}`,
              borderRadius: 2,
            }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** 声のある画面の字（中国語）。 */
export const zh = (text: string, size: number, color: string = C.ink): ReactNode => <span style={{ fontFamily: FONT.zh, fontSize: size, color }}>{text}</span>;
