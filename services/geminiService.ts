import { GoogleGenAI } from "@google/genai";

// Vite exposes env vars via import.meta.env
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Only create the client if the key exists
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

const SCENE_PROMPTS = [
  "A view from inside a modern glass cabin deep in a lush, green Norwegian forest. Rain is streaking heavily against the floor-to-ceiling window. Outside is a sea of pine trees and ferns in mist. Inside is cozy, wood-paneled, and warm. Cinematic, photorealistic, 8k, moody.",
  "Looking out a massive rainy window onto a secluded zen garden filled with wet stones, moss, and maple trees. The perspective is from a low, comfortable seating area. Soft, cool natural light. Peaceful, meditative, highly detailed, 8k.",
  "A wide shot from inside a greenhouse converted into a reading room. Rain pouring on the glass roof and walls. Surrounded by dense, vibrant jungle plants outside the glass. Inside is dry and safe. Atmospheric, moody, nature-focused.",
  "A bedroom view overlooking a misty, rain-soaked valley in the Pacific Northwest. Endless evergreen trees fading into the fog. The window frame is dark wood. Rain droplets focus on the glass. Secluded, quiet, cinematic.",
  "A modern study with a corner glass window looking out at a rainy birch forest in autumn. Wet leaves, grey sky, white tree trunks. The interior reflection is subtle. Melancholic, beautiful, high resolution."
];

export const generateWritingPrompt = async (): Promise<string> => {
    if (!ai) {
    // App should NOT crash if AI is not configured
    return "Soft rain drifts through quiet thoughts.";
  }
  try {
    const model = 'gemini-3-flash-preview';
    const systemInstruction = `You are a gentle, poetic muse. Your task is to write a single, short, sweet, beautifully written one-sentence poem.
    The theme should be atmospheric, related to rain, nature, solitude, or quiet reflection.
    It should feel like a whisper. Strictly one sentence. No explanations, just the poem.`;

    const response = await ai.models.generateContent({
      model,
      contents: "Whisper a short poem to me.",
      config: {
        systemInstruction,
        temperature: 1.1, // High temperature for creativity
      }
    });

    return response.text || "Soft rain whispers secrets to the quiet earth.";
  } catch (error) {
    console.error("Failed to generate prompt:", error);
    return "Listen to the rain and let your thoughts drift.";
  }
};

export const generateStudyBackground = async (): Promise<string | null> => {
  try {
    // Select a random scene from the list
    const randomPrompt = SCENE_PROMPTS[Math.floor(Math.random() * SCENE_PROMPTS.length)];
    
    const model = 'gemini-2.5-flash-image';
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [{ text: randomPrompt }]
      },
      config: {
        imageConfig: {
            aspectRatio: "16:9"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Failed to generate image:", error);
    return null;
  }
};
