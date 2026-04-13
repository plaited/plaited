import * as z from 'zod'

/** @public */
export const BashDetailSchema = z.object({
  path: z.string().describe('Workspace-local path to the Bun worker module to execute'),
  args: z.array(z.string()).describe('Arguments to pass to the worker module'),
  timeout: z.number().optional().describe('Optional timeout in milliseconds'),
})

export type BashDetail = z.infer<typeof BashDetailSchema>
