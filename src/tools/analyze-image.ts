/**
 * Vision analysis tool — image/video to structured description via VLM.
 *
 * @remarks
 * Wraps an OpenAI-compatible `/v1/chat/completions` endpoint with vision
 * capabilities (Qwen 2.5 VL via MLX-VLM or vLLM). Accepts a local image
 * path or HTTP URL and returns a structured description with optional object
 * localization and OCR text. Falls back to mock data when no URL is set.
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

export const AnalyzeImageInputSchema = z.object({
  imagePath: z.string().min(1).describe('Absolute or workspace-relative path to the image file, or an HTTP(S) URL'),
  prompt: z
    .string()
    .optional()
    .describe('Optional instruction for the VLM (e.g. "extract all text" or "list objects with bounding boxes")'),
})

export const DetectedObjectSchema = z.object({
  label: z.string().describe('Object class label'),
  confidence: z.number().min(0).max(1).optional().describe('Detection confidence score'),
  bbox: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional()
    .describe('Bounding box in pixels (origin top-left)'),
})

export const AnalyzeImageOutputSchema = z.object({
  description: z.string().describe('Natural language description of the image'),
  objects: z.array(DetectedObjectSchema).optional().describe('Detected objects (if localization was requested)'),
  text: z.string().optional().describe('OCR-extracted text (if text extraction was requested)'),
  model: z.string().optional().describe('Vision model used'),
})

export type AnalyzeImageInput = z.infer<typeof AnalyzeImageInputSchema>
export type AnalyzeImageOutput = z.infer<typeof AnalyzeImageOutputSchema>

// ============================================================================
// Image encoding helper
// ============================================================================

const imageToBase64 = async (imagePath: string, workspace: string): Promise<string> => {
  const absPath = imagePath.startsWith('/') ? imagePath : resolve(workspace, imagePath)
  const file = Bun.file(absPath)
  if (!(await file.exists())) throw new Error(`Image not found: ${absPath}`)
  const bytes = await file.bytes()
  return Buffer.from(bytes).toString('base64')
}

const isUrl = (path: string): boolean => path.startsWith('http://') || path.startsWith('https://')

// ============================================================================
// VLM backend
// ============================================================================

const analyzeWithVlm = async (
  imagePath: string,
  prompt: string,
  url: string,
  workspace: string,
  signal: AbortSignal,
): Promise<AnalyzeImageOutput> => {
  let imageContent: { type: 'image_url'; image_url: { url: string } }

  if (isUrl(imagePath)) {
    imageContent = { type: 'image_url', image_url: { url: imagePath } }
  } else {
    const b64 = await imageToBase64(imagePath, workspace)
    const ext = imagePath.split('.').pop()?.toLowerCase() ?? 'jpeg'
    const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg'
    imageContent = { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } }
  }

  const response = await fetch(`${url}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'vision',
      messages: [
        {
          role: 'user',
          content: [
            imageContent,
            { type: 'text', text: prompt },
          ],
        },
      ],
      max_tokens: 1024,
    }),
    signal,
  })

  if (!response.ok) throw new Error(`Vision API error: ${response.status} ${response.statusText}`)

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>
    model?: string
  }
  const content = data.choices[0]?.message.content ?? ''

  // Attempt to parse structured JSON from the response
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ?? content.match(/(\{[\s\S]*\})/)
  if (jsonMatch?.[1]) {
    try {
      const structured = JSON.parse(jsonMatch[1]) as Record<string, unknown>
      return AnalyzeImageOutputSchema.parse({
        description: structured.description ?? content,
        objects: structured.objects,
        text: structured.text,
        model: data.model,
      })
    } catch {
      // Fall through to plain description
    }
  }

  return { description: content, model: data.model }
}

// ============================================================================
// Mock backend
// ============================================================================

const MOCK_OUTPUT: AnalyzeImageOutput = {
  description: 'Mock image analysis: a rectangular UI component with labeled fields and interactive controls.',
  objects: [
    { label: 'button', confidence: 0.95 },
    { label: 'input_field', confidence: 0.91 },
    { label: 'label', confidence: 0.87 },
  ],
  text: 'Submit  Cancel  Enter your name',
  model: 'mock-vision',
}

// ============================================================================
// Handler factory
// ============================================================================

/**
 * Create an analyze_image tool handler backed by a real or mock VLM endpoint.
 *
 * @param options - `url` for real MLX-VLM endpoint; omit for mock mode
 * @returns ToolHandler callable by the agent executor
 *
 * @public
 */
export const createAnalyzeImageHandler = (options: { url?: string } = {}): ToolHandler => {
  return async (rawArgs: Record<string, unknown>, ctx: ToolContext): Promise<AnalyzeImageOutput> => {
    const parsed = AnalyzeImageInputSchema.safeParse(rawArgs)
    if (!parsed.success) throw new Error(`Invalid analyze_image input: ${parsed.error.message}`)
    const { imagePath, prompt = 'Describe this image in detail. If there is text, extract it. If there are UI elements, list them.' } = parsed.data

    if (!options.url) return MOCK_OUTPUT

    return analyzeWithVlm(imagePath, prompt, options.url, ctx.workspace, ctx.signal)
  }
}

// ============================================================================
// Tool definition and risk tags
// ============================================================================

/** Risk tags for the analyze_image tool */
export const analyzeImageRiskTags: string[] = [RISK_TAG.workspace, RISK_TAG.inbound]

/** ToolDefinition for the analyze_image tool */
export const analyzeImageToolDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'analyze_image',
    description:
      'Analyze an image using a vision language model. Returns a description, detected objects, ' +
      'and extracted text. Accepts local file paths (absolute or workspace-relative) or HTTP URLs.',
    parameters: {
      type: 'object',
      properties: {
        imagePath: {
          type: 'string',
          description: 'Path to image file or HTTP(S) URL',
        },
        prompt: {
          type: 'string',
          description: 'Optional instruction (e.g. "extract all text" or "list UI elements")',
        },
      },
      required: ['imagePath'],
    },
  },
  tags: analyzeImageRiskTags,
}
