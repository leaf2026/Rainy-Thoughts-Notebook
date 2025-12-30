export interface AppSettings {
  // Media Source
  backgroundUrl: string | null;
  autoFitBackground: boolean;

  // Atmosphere
  rainIntensity: number; // 0 to 1
  glassBlur: number; // 0 to 1 (Shader blur)
  rainSpeed: number; // 0.1 to 3.0
  rainDropletSize: number; // 0.5 to 2.0
  stormIntensity: number; // 0 to 1 (New: Controls lightning frequency/thunder)

  // Optics
  refraction: number; // 0 to 1.5
  zoom: number; // 0.5 to 2.0

  // Image
  brightness: number; // 0 to 2
  contrast: number; // 0 to 2

  // Interface Card (Editor)
  editorOpacity: number; // 0 to 100 (%)
  editorBlur: number; // 0 to 50 (px)
  editorRadius: number; // 0 to 50 (px)
  editorNoise: number; // 0 to 100 (%)
  editorShadow: number; // 0 to 100 (%)
  editorSaturation: number; // 0 to 200 (%)

  // Audio (Hidden in UI mostly, but kept for state)
  audioVolume: number;
  isAudioPlaying: boolean;
}

export interface WritingPrompt {
  text: string;
  source?: string;
}