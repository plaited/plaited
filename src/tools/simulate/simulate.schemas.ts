import { z } from 'zod'

export const SimulateConfigSchema = z.object({
  toolCall: z
    .object({
      id: z.string(),
      name: z.string(),
      arguments: z.record(z.string(), z.unknown()),
    })
    .describe('The proposed tool call to simulate'),
  history: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant', 'tool']),
        content: z.string().nullish(),
      }),
    )
    .optional()
    .default([])
    .describe('Recent conversation history'),
  plan: z
    .object({
      goal: z.string(),
      steps: z.array(
        z.object({
          id: z.string(),
          intent: z.string(),
          tools: z.array(z.string()),
          depends: z.array(z.string()).optional(),
        }),
      ),
    })
    .nullish()
    .describe('Current agent plan for context'),
  stateContext: z.string().optional().describe('Additional state context for the simulation'),
})
