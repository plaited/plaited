import * as z from 'zod'
import { AGENT_CORE, AGENT_CORE_EVENTS } from './agent.constants.ts'
import { BashDetailSchema, type ToolBashRequestDetail, ToolBashRequestDetailSchema } from './agent.schemas.ts'

const CreateToolBashRequestEventInputSchema = z.object({
  correlationId: z.string().min(1),
  modelCallId: z.string().optional(),
  bash: BashDetailSchema,
})

export type CreateToolBashRequestEventInput = z.input<typeof CreateToolBashRequestEventInputSchema>

export type ToolBashRequestEvent = {
  type: `${typeof AGENT_CORE}:${typeof AGENT_CORE_EVENTS.tool_bash_request}`
  detail: ToolBashRequestDetail
}

/**
 * Creates the canonical agent core tool-bash request event for execution gating.
 *
 * @public
 */
export const createToolBashRequestEvent = (input: CreateToolBashRequestEventInput): ToolBashRequestEvent => {
  const { correlationId, bash } = CreateToolBashRequestEventInputSchema.parse(input)
  const detail = ToolBashRequestDetailSchema.parse({
    requestId: Bun.randomUUIDv7(),
    correlationId,
    bash,
  })

  return {
    type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_request}`,
    detail,
  }
}
