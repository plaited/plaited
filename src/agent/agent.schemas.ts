import * as z from 'zod'

export const AgentPromptSchema = z
  .object({
    prompt: z.string().min(1),
  })
  .describe('Input for sending a prompt to an agent runtime.')

export type AgentPrompt = z.output<typeof AgentPromptSchema>
