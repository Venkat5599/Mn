import React from "react";
import { Composition } from "remotion";
import { Ad, adFrames } from "./Ad";
import { FPS, Pitch, pitchFrames } from "./Pitch";

export const Root: React.FC = () => (
  <>
    <Composition id="Pitch" component={Pitch} durationInFrames={pitchFrames} fps={FPS} width={1920} height={1080} />
    <Composition id="Ad" component={Ad} durationInFrames={adFrames} fps={FPS} width={1920} height={1080} />
  </>
);
