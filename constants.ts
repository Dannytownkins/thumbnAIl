
import { ThumbnailStyle, BrandFont } from "./types";

export const THUMBNAIL_STYLES = [
  { value: ThumbnailStyle.CLICKBAIT_SHOCKED, label: "😱 Shock & Awe", icon: "😮" },
  { value: ThumbnailStyle.MINIMALIST_MODERN, label: "✨ Minimalist Tech", icon: "💻" },
  { value: ThumbnailStyle.GAMING_HIGH_ENERGY, label: "🎮 Gaming Neon", icon: "🕹️" },
  { value: ThumbnailStyle.ILLUSTRATIVE_STORY, label: "🎨 Illustrated Story", icon: "🖌️" },
  { value: ThumbnailStyle.CINEMATIC_REALISTIC, label: "🎬 Cinematic", icon: "🎥" },
  { value: ThumbnailStyle.VS_BATTLE, label: "🆚 Versus Mode", icon: "⚔️" },
];

export const BRAND_FONTS = [
  { value: BrandFont.BEBAS_NEUE, label: "Bebas Neue (Headline)", className: "font-bebas" },
  { value: BrandFont.ANTON, label: "Anton (Impactful)", className: "font-anton" },
  { value: BrandFont.MONTSERRAT, label: "Montserrat (Modern)", className: "font-montserrat" },
  { value: BrandFont.ROBOTO_CONDENSED, label: "Roboto (Subtitle)", className: "font-roboto" },
];

export const DEFAULT_SYSTEM_INSTRUCTION = `
You are a world-class YouTube Strategist and Art Director. 
Your goal is to brainstorm viral thumbnail concepts that maximize Click-Through Rate (CTR).
Focus on high contrast, curiosity gaps, emotional triggers, and clear visual hierarchy.
`;

export const SAMPLE_BACKGROUNDS = [
  "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop", // Neon
  "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=2074&auto=format&fit=crop", // Dark Bokeh
  "https://images.unsplash.com/photo-1621252179027-94459d27d3ee?q=80&w=2070&auto=format&fit=crop", // Gaming Room
  "https://images.unsplash.com/photo-1506318137071-a8bcbf673336?q=80&w=2070&auto=format&fit=crop", // Abstract Texture
  "https://images.unsplash.com/photo-1605218427368-35b0896882ce?q=80&w=2070&auto=format&fit=crop", // Modern Gradient
  "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=2070&auto=format&fit=crop", // Clean Pastel
];

// Pre-defined assets (Using high quality CDN icons)
export const COMMON_ASSETS = [
  {
    category: "YouTube Essentials",
    items: [
      "https://upload.wikimedia.org/wikipedia/commons/0/09/YouTube_full-color_icon_%282017%29.svg", // Logo
      "https://cdn-icons-png.flaticon.com/512/1384/1384060.png", // Play Button
      "https://cdn-icons-png.flaticon.com/512/3670/3670151.png", // Subscribe
      "https://cdn-icons-png.flaticon.com/512/15713/15713230.png", // Bell
      "https://cdn-icons-png.flaticon.com/512/7595/7595571.png", // Live Badge
    ]
  },
  {
    category: "Shapes & Arrows",
    items: [
      "https://cdn-icons-png.flaticon.com/512/122/122641.png", // Basic Red Arrow
      "https://cdn-icons-png.flaticon.com/512/545/545682.png", // Curved Arrow
      "https://cdn-icons-png.flaticon.com/512/109/109617.png", // Sharp Pointer
      "https://cdn-icons-png.flaticon.com/512/5246/5246649.png", // Red Circle Scribble
      "https://cdn-icons-png.flaticon.com/512/10089/10089700.png", // Red X Mark
    ]
  },
  {
    category: "Viral Reactions",
    items: [
      "https://cdn-icons-png.flaticon.com/512/742/742751.png", // Shocked
      "https://cdn-icons-png.flaticon.com/512/742/742752.png", // Thinking
      "https://cdn-icons-png.flaticon.com/512/742/742920.png", // Money Eyes
      "https://cdn-icons-png.flaticon.com/512/496/496366.png", // Fire
      "https://cdn-icons-png.flaticon.com/512/16699/16699493.png", // 100 Percent
      "https://cdn-icons-png.flaticon.com/512/179/179386.png", // Danger Skull
    ]
  },
  {
    category: "Trust Badges",
    items: [
      "https://cdn-icons-png.flaticon.com/512/190/190411.png", // Verified
      "https://cdn-icons-png.flaticon.com/512/1828/1828884.png", // Star
      "https://cdn-icons-png.flaticon.com/512/14090/14090477.png", // A+ Score
      "https://cdn-icons-png.flaticon.com/512/5229/5229380.png", // Money Bag
    ]
  }
];
