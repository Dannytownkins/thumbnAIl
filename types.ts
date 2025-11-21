
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

export interface BaseLayer {
  id: string;
  type: 'image' | 'text';
  x: number;
  y: number;
  rotation: number;
  visible: boolean;
  locked: boolean;
}

export interface ImageLayer extends BaseLayer {
  type: 'image';
  url: string;
  scale: number;
  glow: boolean;
  glowColor: string;
  shadow: boolean;
  strokeWidth: number;
  strokeColor: string;
  sourceImage?: string; 
  isProduct?: boolean; // To distinguish main product from decorative elements
}

export interface TextLayer extends BaseLayer {
  type: 'text';
  text: string;
  font: BrandFont;
  color: string;
  fontSize: number;
  letterSpacing: number;
  skewX: number;
  
  // Stroke
  strokeColor: string;
  strokeWidth: number;
  
  // Shadow
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
}

export type Layer = ImageLayer | TextLayer;

export interface GradientState {
  color1: string;
  color2: string;
  direction: 'to right' | 'to bottom' | 'to bottom right' | 'to top right';
}

export interface CanvasState {
  backgroundType: 'image' | 'gradient';
  backgroundUrl: string | null;
  backgroundGradient: GradientState;
  layers: Layer[]; // Unified layer stack (Index 0 = Background/Bottom, Last Index = Foreground/Top)
}
