import type { Model } from '../agent.types.ts'
import { createOpenAICompatModel } from './openai-compat.ts'

/**
 * Configuration for the Google Gemini API backend.
 *
 * @public
 */
export type GeminiOptions = {
  /** Gemini API key */
  apiKey: string
  /** Model identifier (default: "gemini-2.5-flash") */
  model?: string
}

const GEMINI_OPENAI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai'

/**
 * Creates a Model for the Google Gemini API via its OpenAI-compatible endpoint.
 *
 * @remarks
 * Delegates to `createOpenAICompatModel` using Gemini's OpenAI-compat
 * endpoint at `generativelanguage.googleapis.com/v1beta/openai`.
 * No additional dependencies required beyond `fetch`.
 *
 * @public
 */
export const createGeminiModel = ({ apiKey, model = 'gemini-2.5-flash' }: GeminiOptions): Model =>
  createOpenAICompatModel({
    baseUrl: GEMINI_OPENAI_BASE,
    apiKey,
    model,
  })
