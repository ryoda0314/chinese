import { useEffect, useState } from "react";
import { staticFile, useDelayRender } from "remotion";

// ことのおと の紙と墨と、アクセント（../src/app/globals.css）。紫は、また出会うもの。
export const C = {
  paper: "#fcfbf8",
  surface: "#f1f4f8",
  ink: "#172033",
  ink2: "#3b4558",
  muted: "#5c6578",
  faint: "#8c94a5",
  line: "#e4e7ec",
  line2: "#d4d9e1",
  accent: "#0a64f0",
  tint: "#e6f0ff",
  again: "#6a4fe0",
  againTint: "#efebff",
} as const;

// アプリの字（../src/app/layout.tsx）：IBM Plex Sans（ピンインの声調記号も）、IBM Plex Sans JP、Noto Sans SC、しっぽり明朝。
export const FONT = {
  ui: `"Plex", "PlexJP", sans-serif`,
  ja: `"PlexJP", sans-serif`,
  zh: `"NotoSC", sans-serif`,
  en: `"Plex", sans-serif`,
  mincho: `"Shippori", serif`,
} as const;

// `npm run assets` が public/fonts に置く（映像に出てくる字だけに切ったもの）。
const FACES: [family: string, file: string, weight: string][] = [
  ["Plex", "fonts/IBMPlexSans.ttf", "100 700"],
  ["PlexJP", "fonts/IBMPlexSansJP-Regular.ttf", "400"],
  ["PlexJP", "fonts/IBMPlexSansJP-Medium.ttf", "500"],
  ["PlexJP", "fonts/IBMPlexSansJP-SemiBold.ttf", "600"],
  ["NotoSC", "fonts/NotoSansSC.ttf", "100 900"],
  ["Shippori", "fonts/ShipporiMincho-Bold.ttf", "700"],
];

let loading: Promise<unknown> | null = null;

/** 字が読み終わるまで、どのコマも待たせる（映像の根から呼ぶ）。 */
export function useFonts() {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    loading ??= Promise.all(
      FACES.map(([family, file, weight]) => {
        const face = new FontFace(family, `url(${staticFile(file)})`, { weight });
        document.fonts.add(face);
        return face.load();
      }),
    );
    loading.then(() => continueRender(handle), cancelRender);
  }, [handle, continueRender, cancelRender]);
}
