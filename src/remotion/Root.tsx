import React from "react";
import { Composition } from "remotion";
import { ReelComposition, defaultReelProps, type ReelCompositionProps } from "./ReelComposition.js";

const FPS = 30;

export function RemotionRoot() {
  return (
    <Composition
      id="Reel"
      component={ReelComposition}
      durationInFrames={Math.round(defaultReelProps.totalDurationSeconds * FPS)}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={defaultReelProps}
      calculateMetadata={async ({ props }: { props: ReelCompositionProps }) => ({
        durationInFrames: Math.max(1, Math.round(props.totalDurationSeconds * FPS)),
      })}
    />
  );
}
