import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_JP, Noto_Sans_SC, Shippori_Mincho } from "next/font/google";
import { ja } from "@/lib/i18n/ja";
import "./globals.css";

// latin-ext carries the pinyin tone marks (ǎ ǚ …).
const plex = IBM_Plex_Sans({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], variable: "--font-plex" });
const plexJp = IBM_Plex_Sans_JP({ weight: ["400", "500", "600"], variable: "--font-plex-jp", preload: false });
const notoSc = Noto_Sans_SC({ weight: ["400", "500"], variable: "--font-noto-sc", preload: false });
// Only the wordmark ことのね uses it.
const shippori = Shippori_Mincho({ weight: ["700"], variable: "--font-shippori", preload: false });

export const metadata: Metadata = {
  title: { default: ja.name, template: `%s | ${ja.name}` },
  description: ja.description,
  applicationName: ja.name,
};

export const viewport: Viewport = {
  themeColor: "#fcfbf8",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${plex.variable} ${plexJp.variable} ${notoSc.variable} ${shippori.variable}`}>
      <body>
        <div className="status-fill" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
