export interface VoiceoverBeat {
  index: number;
  text: string;
  audioPath: string;
  startSeconds: number;
  durationSeconds: number;
}

export interface VoiceoverTimeline {
  briefId: string;
  generatedAt: string;
  voice: string;
  model: string;
  totalDurationSeconds: number;
  beats: VoiceoverBeat[];
}
