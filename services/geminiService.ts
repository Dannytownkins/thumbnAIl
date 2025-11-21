
import { GoogleGenAI, Type } from "@google/genai";
import { Concept, ThumbnailStyle, BrainstormResponse } from "../types";
import { DEFAULT_SYSTEM_INSTRUCTION } from "../constants";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Analyzes an uploaded image to extract the visual style (Brand Identity).
 */
export const analyzeImageStyle = async (base64Data: string, mimeType: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Analyze this YouTube thumbnail image. 
    Reverse engineer the design style into a concise art direction prompt.
    Focus specifically on:
    1. Color Palette (e.g., 'Neon Green and Black', 'Pastel', 'High Contrast Red')
    2. Lighting (e.g., 'Studio lighting', 'Dark moody', 'Bright outdoor')
    3. Composition (e.g., 'Close up face with text on right', 'Split screen')
    4. Typography Style (if visible)
    5. Overall Vibe (e.g., 'Chaotic gaming', 'Professional Education', 'Lifestyle Vlog')
    
    Output a single paragraph description that I can use to generate new images in this exact same style.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: prompt }
        ]
      }
    });

    return response.text || "Could not analyze image style.";
  } catch (error) {
    console.error("Style analysis failed:", error);
    throw error;
  }
};

/**
 * Brainstorms thumbnail concepts based on a user's video topic.
 * Uses gemini-2.5-flash for fast reasoning.
 */
export const brainstormConcepts = async (
  topic: string,
  preferredStyle: ThumbnailStyle,
  brandStyle?: string
): Promise<Concept[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  let prompt = `
    Video Topic: "${topic}"
    Preferred Style: "${preferredStyle}"
    
    Generate 3 distinct, viral YouTube thumbnail concepts for this video. 
    Each concept should have a catchy title, a detailed visual description for an artist, and short text to place on the image (hook text).
    Make them distinct: one safe/standard, one aggressive/clickbaity, one creative/out-of-box.
  `;

  if (brandStyle) {
    prompt += `
      IMPORTANT: The user has a specific Brand Style. All concepts MUST align with this visual identity:
      "${brandStyle}"
      Ensure the visual descriptions explicitly incorporate these brand elements (colors, mood, lighting).
    `;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            concepts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  visualDescription: { type: Type.STRING },
                  hookText: { type: Type.STRING },
                  reasoning: { type: Type.STRING },
                },
                required: ["id", "title", "visualDescription", "hookText", "reasoning"],
              },
            },
          },
        },
      },
    });

    if (response.text) {
      const data = JSON.parse(response.text) as BrainstormResponse;
      return data.concepts;
    }
    return [];
  } catch (error) {
    console.error("Brainstorming failed:", error);
    throw error;
  }
};

/**
 * Generates a high-resolution thumbnail image.
 * Can optionally take a Product Image to incorporate into the generation.
 * Implements Fallback Logic: Gemini 3 Pro -> Gemini 2.5 Flash.
 */
export const generateThumbnailImage = async (
  concept: Concept,
  style: ThumbnailStyle,
  includeText: boolean,
  brandStyle?: string,
  productImageBase64?: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Construct a powerful image prompt
  let imagePrompt = `
    Create a high-quality YouTube thumbnail.
    Subject: ${concept.visualDescription}
    Base Style: ${style}. 
  `;

  if (productImageBase64) {
    imagePrompt += `
      INSTRUCTION: The user has provided a product/subject image. 
      Integrate this object seamlessly into the scene. 
      Ensure the lighting and perspective of the background matches the provided object.
      Make the object the focal point.
    `;
  }

  if (brandStyle) {
    imagePrompt += `
      CRITICAL BRAND GUIDELINES:
      Apply this specific visual style to the image: ${brandStyle}.
      Ensure the colors, lighting, and composition match this brand description exactly.
    `;
  } else {
    imagePrompt += `
      Composition: Rule of thirds, high contrast, vibrant colors, 4k resolution, highly detailed.
      Mood: Exciting, Urgent, Professional.
    `;
  }

  if (includeText && concept.hookText) {
    imagePrompt += `
      Render the following text clearly on the image in a bold, readable 3D font that contrasts with the background: "${concept.hookText}".
      Ensure the text does not cover the main subject's face.
    `;
  } else {
    imagePrompt += ` Do not render any text. Leave negative space for text overlay.`;
  }

  const parts: any[] = [];
  if (productImageBase64) {
     // Remove header if present
     const cleanBase64 = productImageBase64.split(',')[1] || productImageBase64;
     parts.push({
        inlineData: {
           data: cleanBase64,
           mimeType: 'image/png'
        }
     });
  }
  parts.push({ text: imagePrompt });

  // --- STRATEGY: Try High Quality (Pro) first, then Fallback to Speed (Flash) ---
  
  // Attempt 1: Gemini 3 Pro Image
  try {
    console.log("Attempting generation with gemini-3-pro-image-preview...");
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "2K", 
        },
      },
    });

    if (response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
       return `data:image/png;base64,${response.candidates[0].content.parts[0].inlineData.data}`;
    }
  } catch (error) {
    console.warn("Gemini 3 Pro failed (likely quota or timeout). Falling back to Flash Image.", error);
  }

  // Attempt 2: Gemini 2.5 Flash Image
  try {
    // Small delay to allow transient API issues to settle
    await delay(1000); 
    console.log("Attempting fallback generation with gemini-2.5-flash-image...");
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          // Note: imageSize is NOT supported on Flash models
        },
      },
    });

    if (response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
       return `data:image/png;base64,${response.candidates[0].content.parts[0].inlineData.data}`;
    }
  } catch (error) {
    console.error("All generation attempts failed:", error);
    throw error;
  }
  
  throw new Error("No image generated after multiple attempts.");
};

/**
 * Generates a specific layer (Background or Subject) for a concept.
 * Uses Gemini 2.5 Flash Image for efficiency as these are editing tasks.
 */
export const generateLayer = async (
  concept: Concept,
  type: 'background' | 'subject',
  referenceImageUrl?: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const parts: any[] = [];

  // If we have a reference image, we use it for Image-to-Image editing
  if (referenceImageUrl) {
    const base64Data = referenceImageUrl.split(',')[1] || referenceImageUrl;
    parts.push({
      inlineData: {
        data: base64Data,
        mimeType: "image/png"
      }
    });
  }

  let prompt = "";
  
  if (type === 'background') {
    prompt = `
      Edit the provided image to create a clean background.
      Action: Remove the main character, subject, and any text from the foreground.
      Inpaint the area where the subject was to create a clean, empty background scene that matches the original environment.
      Keep the lighting and style exactly the same as the original.
    `;
    if (!referenceImageUrl) {
      prompt = `Create a clean background for: ${concept.visualDescription}. No people.`;
    }
  } else {
    // Subject
    prompt = `
      Edit the provided image to isolate the main subject.
      Action: Keep the main character/subject EXACTLY as they are in the original image.
      Replace the entire background with a SOLID NEON GREEN color (#00FF00).
      Ensure the edges of the subject are sharp and clean for chroma keying.
      Do not change the lighting or pose of the subject.
    `;
     if (!referenceImageUrl) {
      prompt = `Create a character sticker for: ${concept.visualDescription}. Solid green background.`;
    }
  }

  parts.push({ text: prompt });

  try {
    // Use Flash Image for utility tasks to save Pro quota
    // It handles instruction-following for edits very well
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: parts },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
        },
      },
    });

    if (response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
       return `data:image/png;base64,${response.candidates[0].content.parts[0].inlineData.data}`;
    }
    throw new Error("No layer data found");
  } catch (error) {
    console.error(`Layer generation (${type}) failed:`, error);
    throw error;
  }
};

/**
 * Takes a product image and asks Gemini to return it on a green screen for chroma keying.
 * Uses Flash Image for efficiency.
 */
export const isolateProductSubject = async (base64Data: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Isolate the product or main subject in this image.
    Keep the subject exactly as is (lighting, angle, details).
    Replace the entire background with SOLID NEON GREEN (#00FF00).
    Ensure edges are sharp for chroma keying.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: "image/png" } },
          { text: prompt }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    if (response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
       return `data:image/png;base64,${response.candidates[0].content.parts[0].inlineData.data}`;
    }
    throw new Error("Failed to isolate subject");
  } catch (error) {
    console.error("Subject isolation failed:", error);
    throw error;
  }
}
