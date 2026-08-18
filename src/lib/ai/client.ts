import { GoogleGenAI } from "@google/genai";

/**
 * Single place the AI client and model id are constructed — every AI
 * feature (Suggest Mode, Q&A) calls generateText()/streamText() below
 * instead of hardcoding a model string or touching the SDK directly.
 * Provider: Gemini (free tier available — chosen for that reason while
 * ANTHROPIC_API_KEY has no billing set up; swapping provider later only
 * means rewriting this file, not the 6+ routes that call it).
 * Requires GEMINI_API_KEY — get one at https://aistudio.google.com/apikey.
 */
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
// "-latest" alias instead of a pinned version: a pinned flash model gets
// deprecated for new API keys periodically (hit this during Fase 5 build —
// gemini-2.5-flash was already unavailable), the alias tracks whatever
// Google currently considers the default fast model instead.
export const AI_MODEL = "gemini-flash-latest";

interface GenerateParams {
  system: string;
  prompt: string;
  maxOutputTokens?: number;
}

export async function generateText({ system, prompt, maxOutputTokens = 4096 }: GenerateParams): Promise<string> {
  const response = await ai.models.generateContent({
    model: AI_MODEL,
    contents: prompt,
    config: { systemInstruction: system, maxOutputTokens },
  });
  const text = response.text;
  if (!text) throw new Error("AI response had no text content");
  return text;
}

/** Async-iterable of text chunks — used only by the Q&A endpoint, where perceived latency matters more than total latency. */
export async function* streamText({ system, prompt, maxOutputTokens = 2048 }: GenerateParams): AsyncGenerator<string> {
  const stream = await ai.models.generateContentStream({
    model: AI_MODEL,
    contents: prompt,
    config: { systemInstruction: system, maxOutputTokens },
  });
  for await (const chunk of stream) {
    if (chunk.text) yield chunk.text;
  }
}
