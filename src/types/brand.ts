export interface ContentPillar {
  name: string;
  description: string;
  exampleAngles: string[];
}

export interface ReelsBrand {
  name: string;
  tagline: string;
  positioning: string;
  location: string;
  website: string;
  offerings: string[];
  toneKeywords: string[];
  targetAudience: string;
  pillars: ContentPillar[];
  ctaStyles: string[];
  contentGoals: string[];
  visualDesign: {
    colors: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      surface: string;
    };
    fonts: { heading: string; body: string };
    logoPath?: string;
    styleKeywords: string[];
  };
  createdAt: string;
  updatedAt: string;
}
