import { readDataSafe, writeData } from "./data";
import type { ReelsBrand } from "../types/brand";

const FILENAME = "brand.json";

export const DEFAULT_BRAND: ReelsBrand = {
  name: "Chef Rulo & Family",
  tagline: "Fire. Ritual. Soul.",
  positioning:
    "Community Is the New Luxury — modern Argentine food specialist bringing asado ritual and empanada craft to London, crafted with care and rooted in Argentine tradition.",
  location: "Bromley, London",
  website: "https://chefrulo.com",
  offerings: [
    "Asado experiences / catering",
    "Frozen empanadas",
    "Pop-up events & milongas",
    "Corporate catering",
    "Private events",
    "Physical / online shop",
  ],
  toneKeywords: [
    "warm",
    "inviting",
    "aspirational",
    "honest",
    "communal",
    "ritualistic",
    "unpretentious",
  ],
  targetAudience:
    "Argentine diaspora and Argentina-curious Londoners who value authentic food culture and communal experiences",
  pillars: [
    {
      name: "Product & Craft",
      description: "The making, the ingredients, the process behind the food itself.",
      exampleAngles: [
        "How we make our empanada dough",
        "Why our frozen empanadas actually work",
        "Before and after: finished product",
        "Ingredients and suppliers",
      ],
    },
    {
      name: "Experience & Events",
      description: "What it feels like to be at a Chef Rulo event, pop-up, or milonga.",
      exampleAngles: [
        "El Boliche video with people and music",
        "Behind the scenes at an event",
        "People eating and celebrating at an event",
        "This is how last night went at El Boliche",
      ],
    },
    {
      name: "People & Story",
      description: "The human/founder story behind the brand — real, not polished.",
      exampleAngles: [
        "How Chef Rulo started",
        "A mistake we made and what we learned",
        "Real life of running a food business",
        "Tough business decisions",
      ],
    },
    {
      name: "Solutions & Formats",
      description: "The practical offerings and how people can access them.",
      exampleAngles: [
        "Frozen empanadas for a quick dinner",
        "Corporate catering",
        "Private events",
        "Physical / online shop",
      ],
    },
    {
      name: "Culture & Identity",
      description: "Argentine food culture, ritual, and tradition as a story worth telling.",
      exampleAngles: [
        "Argentinian sharing ritual",
        "Tango and food culture",
        "Argentinian tradition",
        "Cooperative culture",
      ],
    },
  ],
  ctaStyles: ["Learn more", "Get in touch", "Book now", "Discover more"],
  contentGoals: [
    "Authority + Branding",
    "Trust + Conversion",
    "Emotional branding",
    "Authority + Identity",
  ],
  visualDesign: {
    colors: {
      primary: "#2b1810",
      secondary: "#7a6b5f",
      accent: "#e94560",
      background: "#faf7f5",
      surface: "#ffffff",
    },
    fonts: { heading: "Playfair Display", body: "Inter" },
    styleKeywords: ["warm", "editorial", "tactile", "unpretentious"],
  },
  createdAt: "",
  updatedAt: "",
};

export async function getBrand(): Promise<ReelsBrand> {
  const brand = await readDataSafe<ReelsBrand>(FILENAME, DEFAULT_BRAND);
  return { ...brand, visualDesign: brand.visualDesign ?? DEFAULT_BRAND.visualDesign };
}

export async function saveBrand(brand: ReelsBrand): Promise<void> {
  const now = new Date().toISOString();
  await writeData(FILENAME, {
    ...brand,
    createdAt: brand.createdAt || now,
    updatedAt: now,
  });
}
