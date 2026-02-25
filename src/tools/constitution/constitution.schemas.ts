import { z } from 'zod'

export const ClassifyRiskConfigSchema = z.object({
  toolName: z.string().describe('Name of the tool being called'),
  args: z.record(z.string(), z.unknown()).describe('Tool call arguments'),
})
