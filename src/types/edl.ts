export interface EdlBeat {
  index: number;
  kind: "clip" | "textcard";
  clipPath?: string;
  trimStartSeconds?: number;
  trimEndSeconds?: number;
}

export interface Edl {
  briefId: string;
  generatedAt: string;
  beats: EdlBeat[];
}
