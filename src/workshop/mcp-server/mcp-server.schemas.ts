import { z } from 'zod'
import type { BPEventTypesToToolConfigs, ToolInputSchemaToEventDetails } from './mcp-server.types.js'
import { PUBLIC_EVENTS } from './mcp-server.constants.js'

export const PUBLIC_EVENT_SCHEMAS = {
  [PUBLIC_EVENTS.get_workshop_href]: {
    title: 'Get server href',
    description: 'Get Workshop root url',
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
}

export type PublicEventDetails = ToolInputSchemaToEventDetails<typeof PUBLIC_EVENT_SCHEMAS>
