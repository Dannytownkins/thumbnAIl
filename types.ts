
export enum ThumbnailStyle {
  CLICKBAIT_SHOCKED = 'Clickbait / Shocked Face',
  MINIMALIST_MODERN = 'Minimalist / Modern Tech',
  GAMING_HIGH_ENERGY = 'Gaming / High Energy',
  ILLUSTRATIVE_STORY = 'Illustrative / Storytime',
  CINEMATIC_REALISTIC = 'Cinematic / Photorealistic',
  VS_BATTLE = 'Versus / Comparison Split',
}

export enum BrandFont {
  BEBAS_NEUE = 'font-bebas',
  ANTON = 'font-anton',
  MONTSERRAT = 'font-montserrat',
  ROBOTO_CONDENSED = 'font-roboto',
}

export interface Concept {
  id: string;
  title: string;
  visualDescription: string;
  hookText: string;
  reasoning: string;
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  conceptId?: string;
  timestamp: number;
  layers?: {
    backgroundUrl?: string;
    subjectUrl?: string;
  };
}

export interface BrainstormResponse {
  concepts: Concept[];
}

export interface BrandProfile {
  id: string;
  name: string;
  styleDescription: string;
  referenceImageUrl?: string;
}

// Generic Asset Layer (Used for Product AND Elements)
export interface AssetLayer {
  id: string;
  type: 'product' | 'element';
  url: string;
  x: number; // Center X in 1920 coords
  y: number; // Center Y in 1080 coords
  scale: number;
  rotation: number;
  glow: boolean;
  glowColor: string;
  shadow: boolean;
  strokeWidth: number; // For outlines (0 = none)
  strokeColor: string;
  sourceImage?: string; // The raw uploaded image before isolation
}

export interface TextLayer {
  id: string;
  text: string;
  font: BrandFont;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  fontSize: number;
  letterSpacing: number; // Kerning
  skewX: number; // Skewing
  x: number; // Center X in 1920 coords
  y: number; // Center Y in 1080 coords
  rotation: number;
  shadowColor: string;
}

export interface GradientState {
  color1: string;
  color2: string;
  direction: 'to right' | 'to bottom' | 'to bottom right' | 'to top right';
}

export interface CanvasState {
  backgroundType: 'image' | 'gradient';
  backgroundUrl: string | null;
  backgroundGradient: GradientState;
  product: AssetLayer | null;
  elements: AssetLayer[]; // Array for extra stickers, icons, logos, etc.
  textLayers: TextLayer[];
}
