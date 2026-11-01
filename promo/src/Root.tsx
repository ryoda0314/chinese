import { Composition, Still } from "remotion";
import { FPS } from "./anim";
import { Card } from "./Card";
import { Promo } from "./Promo";
import { TOTAL } from "./timeline";

export function Root() {
  return (
    <>
      <Composition id="Promo" component={Promo} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
      {/* 一目でわかる紹介画像（npm run card） */}
      <Still id="Card" component={Card} width={1920} height={1080} />
    </>
  );
}
