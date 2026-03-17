/**
 * Text-to-speech tool — synthesize speech audio from text.
 *
 * @remarks
 * Wraps a TTS endpoint (Qwen3-TTS via MLX-Audio or vLLM-Omni) using the
 * OpenAI-compatible `/v1/audio/speech` format. Writes the output audio file
 * to disk and returns the resolved path. Falls back to creating an empty
 * placeholder file in mock mode (suitable for pipeline testing).
 *
 * @public
 */

import { resolve } from 'node:path'
import * as z from 'zod'
import { RISK_TAG } from '../agent/agent.constants.ts'
import type { ToolDefinition } from '../agent/agent.schemas.ts'
import type { ToolContext, ToolHandler } from '../agent/agent.types.ts'

// ============================================================================
// Schemas
// ============================================================================

export const SpeakInputSchema = z.object({
  text: z.string().min(1).max(4096).describe('Text to synthesize (max 4096 characters)'),
  outputPath: z.string().describe('Workspace-relative or absolute path to write the audio file (.wav or .mp3)'),
  voiceId: z.string().optional().describe('Voice identifier for voice cloning (model-specific)'),
  speed: z.number().min(0.25).max(4.0).default(1.0).describe('Speech speed multiplier (default: 1.0)'),
})

export const SpeakOutputSchema = z.object({
  audioPath: z.string().describe('Absolute path to the written audio file'),
  duration: z.number().optional().describe('Estimated duration in seconds'),
  model: z.string().optional().describe('TTS model used'),
  mock: z.boolean().optional().describe('True when using mock backend (no real audio)'),
})

export type SpeakInput = z.infer<typeof SpeakInputSchema>
export type SpeakOutput = z.infer<typeof SpeakOutputSchema>

// ============================================================================
// TTS backend
// ============================================================================

const synthesizeWithTts = async (
  text: string,
  outputPath: string,
  voiceId: string | undefined,
  speed: number,
  url: string,
  workspace: string,
  signal: AbortSignal,
): Promise<SpeakOutput> => {
  const absPath = outputPath.startsWith('/') ? outputPath : resolve(workspace, outputPath)

  const response = await fetch(`${url}/v1/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'tts',
      input: text,
      voice: voiceId ?? 'default',
      speed,
      response_format: absPath.endsWith('.mp3') ? 'mp3' : 'wav',
    }),
    signal,
  })

  if (!response.ok) throw new Error(`TTS API error: ${response.status} ${response.statusText}`)

  const audioBytes = await response.arrayBuffer()
  await Bun.write(absPath, audioBytes)

  // Estimate duration: ~150 words/min at normal speed, ~5 chars/word
  const wordCount = text.split(/\s+/).length
  const duration = Math.round((wordCount / 150) * 60 * (1 / speed))

  return { audioPath: absPath, duration, model: 'qwen3-tts' }
}

// ============================================================================
// Mock backend
// ============================================================================

const createMockAudio = async (outputPath: string, workspace: string): Promise<SpeakOutput> => {
  const absPath = outputPath.startsWith('/') ? outputPath : resolve(workspace, outputPath)
  // Write an empty placeholder so downstream tools can check file existence
  await Bun.write(absPath, new Uint8Array(0))
  return { audioPath: absPath, duration: 0, model: 'mock-tts', mock: true }
}

// ============================================================================
// Handler factory
// ============================================================================

/**
 * Create a speak tool handler backed by a real or mock TTS endpoint.
 *
 * @param options - `url` for real MLX-Audio TTS endpoint; omit for mock mode
 * @returns ToolHandler callable by the agent executor
 *
 * @public
 */
export const createSpeakHandler = (options: { url?: string } = {}): ToolHandler => {
  return async (rawArgs: Record<string, unknown>, ctx: ToolContext): Promise<SpeakOutput> => {
    const parsed = SpeakInputSchema.safeParse(rawArgs)
    if (!parsed.success) throw new Error(`Invalid speak input: ${parsed.error.message}`)
    const { text, outputPath, voiceId, speed } = parsed.data

    if (!options.url) return createMockAudio(outputPath, ctx.workspace)

    return synthesizeWithTts(text, outputPath, voiceId, speed, options.url, ctx.workspace, ctx.signal)
  }
}

// ============================================================================
// Tool definition and risk tags
// ============================================================================

/** Risk tags for the speak tool */
export const speakRiskTags: string[] = [RISK_TAG.workspace, RISK_TAG.inbound]

/** ToolDefinition for the speak tool */
export const speakToolDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'speak',
    description:
      'Synthesize speech from text using a TTS model. Writes an audio file (.wav or .mp3) ' +
      'to the specified path and returns the resolved path and estimated duration.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to convert to speech (max 4096 chars)' },
        outputPath: { type: 'string', description: 'Output file path (.wav or .mp3), relative to workspace' },
        voiceId: { type: 'string', description: 'Voice ID for voice cloning (optional)' },
        speed: { type: 'number', description: 'Speech speed (0.25–4.0, default 1.0)' },
      },
      required: ['text', 'outputPath'],
    },
  },
  tags: speakRiskTags,
}
