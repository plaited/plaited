import { z } from 'zod'
import type { BPEventTypesToToolConfigs, ToolInputSchemaToEventDetails } from './mcp-server.types.js'
import { PUBLIC_EVENTS } from './mcp-server.constants.js'

export const PUBLIC_EVENT_SCHEMAS = {
  [PUBLIC_EVENTS.start_workshop]: {
    title: 'Start UI workshop',
    description: 'Start user interface workshop',
    inputSchema: {
      root: z.string().describe('Directory containing stories typically the root of your project, i.e. (src)'),
      watch: z.optional(z.boolean()).describe('Optionally watch files'),
    },
    outputSchema: {
      href: z.string(),
    },
  },
  [PUBLIC_EVENTS.get_story_routes]: {
    title: 'Get story routes',
    description: 'Get a list pf the story routes',
    outputSchema: {
      routes: z.array(z.string()).describe('List of routes for running stories'),
    },
  },
} satisfies BPEventTypesToToolConfigs<typeof PUBLIC_EVENTS>

export type PublicEventDetails = ToolInputSchemaToEventDetails<typeof PUBLIC_EVENT_SCHEMAS>
