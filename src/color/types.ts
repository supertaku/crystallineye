export type OKLCH = { lightness: number; chroma: number; hue: number };
export type VisualState = {
  colors: [OKLCH, OKLCH, OKLCH];
  weights: [number, number, number];
};

export type MappingFeatures = {
  energy: number;
  brightness: number;
  balance: [number, number, number];
  onset: number;
};
