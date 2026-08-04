export interface EdlBeat {
  index: number;
  kind: "clip" | "textcard";
  targetDurationSeconds: number;
  clipPath?: string;
  filename?: string;
  trimStartSeconds?: number;
  trimEndSeconds?: number;
  warning?: string;
}

export interface EdlFootageClip {
  filename: string;
  durationSeconds: number;
  contactSheetPath?: string;
}

export interface Edl {
  briefId: string;
  generatedAt: string;
  updatedAt: string;
  voiceoverGeneratedAt: string;
  status: "draft" | "approved";
  footage: EdlFootageClip[];
  beats: EdlBeat[];
}
