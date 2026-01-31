import fs from "node:fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Buffer } from "node:buffer";

export const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY_4 || "");

/**
 * Generate an image and return as Buffer.
 * Uses Gemini via Replit AI Integrations.
 */
export async function generateImageBuffer(
  prompt: string,
  size: "1024x1024" | "512x512" | "256x256" = "1024x1024"
): Promise<Buffer> {
  const model = ai.getGenerativeModel({ model: "gemini-2.5-flash-image" });
  const result = await model.generateContent(prompt);
  const response = result.response;
  // Gemini image model returns image bytes differently, usually via parts
  const part = response.candidates?.[0]?.content?.parts?.[0];
  if (part?.inlineData?.data) {
    return Buffer.from(part.inlineData.data, "base64");
  }
  throw new Error("Failed to generate image");
}

/**
 * Edit/combine multiple images into a composite.
 * Currently stubbed out for Gemini migration.
 */
export async function editImages(
  imageFiles: string[],
  prompt: string,
  outputPath?: string
): Promise<Buffer> {
  throw new Error("editImages is not supported with Gemini yet");
}

