import { z } from 'zod'

export const EvaluateConfigSchema = z.object({
  toolCall: z
    .object({
      id: z.string(),
      name: z.string(),
      arguments: z.record(z.string(), z.unknown()),
    })
    .describe('The tool call being evaluated'),
  prediction: z.string().describe('Dreamer prediction to evaluate'),
  riskClass: z.string().optional().default('high_ambiguity').describe('Risk classification of the tool call'),
  goal: z.string().optional().describe('Current plan goal for progress assessment'),
  patterns: z.array(z.string()).optional().describe('Custom regex patterns for symbolic gate (as strings)'),
})
