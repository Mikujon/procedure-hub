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

/**
 * Compliance kill switch (docs/AI-DATA-POLICY.md, SEC-07): procedure content
 * leaves the tenant to Google's Gemini API on every call here. The free
 * tier's data-usage terms are more permissive than the paid/Vertex tier's
 * unconditional no-training commitment — see the policy doc for the exact
 * distinction and the EEA carve-out that may or may not apply to this
 * deployment. Until Compliance has actually confirmed which terms apply,
 * this defaults to enabled (unchanged behavior) but gives them a one-line
 * way to turn every AI feature off tenant-wide without a code deploy.
 */
export function isAiEnabled(): boolean {
  return process.env.AI_FEATURES_ENABLED !== "false";
}

function assertAiEnabled(): void {
  if (!isAiEnabled()) {
    throw new Error(
      "Funzionalità AI disabilitate (AI_FEATURES_ENABLED=false) — vedi docs/AI-DATA-POLICY.md per il motivo."
    );
  }
}

export async function generateText({ system, prompt, maxOutputTokens = 4096 }: GenerateParams): Promise<string> {
  assertAiEnabled();
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
  assertAiEnabled();
  const stream = await ai.models.generateContentStream({
    model: AI_MODEL,
    contents: prompt,
    config: { systemInstruction: system, maxOutputTokens },
  });
  for await (const chunk of stream) {
    if (chunk.text) yield chunk.text;
  }
}
