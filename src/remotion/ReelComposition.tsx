import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useVideoConfig } from "remotion";

// clipPath/audioPath are paths relative to the public/ dir (symlinked to data/ and
// footage/ by the render script), resolved here via staticFile().

export interface RenderBeat {
  index: number;
  startSeconds: number;
  durationSeconds: number;
  kind: "clip" | "textcard";
  clipPath?: string;
  trimStartSeconds?: number;
  trimEndSeconds?: number;
  onScreenText?: string;
  audioPath?: string;
}

export interface ReelCompositionProps {
  [key: string]: unknown;
  beats: RenderBeat[];
  totalDurationSeconds: number;
  brandName: string;
  primaryColor: string;
  accentColor: string;
  hook: string;
  cta: string;
}

export const defaultReelProps: ReelCompositionProps = {
  beats: [],
  totalDurationSeconds: 5,
  brandName: "Chef Rulo & Family",
  primaryColor: "#1a1a2e",
  accentColor: "#e94560",
  hook: "",
  cta: "",
};

function TextCard({
  text,
  accentColor,
  primaryColor,
}: {
  text: string;
  accentColor: string;
  primaryColor: string;
}) {
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${primaryColor}, #000)`,
        justifyContent: "center",
        alignItems: "center",
        padding: 80,
      }}
    >
      <div
        style={{
          color: "white",
          fontSize: 64,
          fontWeight: 700,
          textAlign: "center",
          lineHeight: 1.25,
          fontFamily: "sans-serif",
          textShadow: "0 4px 24px rgba(0,0,0,0.5)",
        }}
      >
        {text}
        <div style={{ height: 12 }} />
        <div style={{ width: 80, height: 6, background: accentColor, margin: "24px auto 0" }} />
      </div>
    </AbsoluteFill>
  );
}

function OnScreenTextOverlay({ text }: { text: string }) {
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 220 }}>
      <div
        style={{
          color: "white",
          fontSize: 44,
          fontWeight: 700,
          textAlign: "center",
          maxWidth: "85%",
          fontFamily: "sans-serif",
          textShadow: "0 2px 12px rgba(0,0,0,0.8)",
          background: "rgba(0,0,0,0.35)",
          padding: "16px 28px",
          borderRadius: 16,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}

export function ReelComposition(props: ReelCompositionProps) {
  const { fps } = useVideoConfig();
  const { beats, primaryColor, accentColor } = props;

  return (
    <AbsoluteFill style={{ background: "black" }}>
      {beats.map((beat) => {
        const startFrame = Math.round(beat.startSeconds * fps);
        const durationFrames = Math.max(1, Math.round(beat.durationSeconds * fps));

        return (
          <Sequence key={beat.index} from={startFrame} durationInFrames={durationFrames}>
            {beat.kind === "clip" && beat.clipPath ? (
              <OffthreadVideo
                src={staticFile(beat.clipPath)}
                trimBefore={Math.round((beat.trimStartSeconds ?? 0) * fps)}
                trimAfter={beat.trimEndSeconds === undefined ? undefined : Math.round(beat.trimEndSeconds * fps)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <TextCard
                text={beat.onScreenText || props.hook}
                accentColor={accentColor}
                primaryColor={primaryColor}
              />
            )}
            {beat.kind === "clip" && beat.onScreenText && (
              <OnScreenTextOverlay text={beat.onScreenText} />
            )}
            {beat.audioPath && <Audio src={staticFile(beat.audioPath)} />}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
