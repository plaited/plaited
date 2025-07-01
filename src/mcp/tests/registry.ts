import { z } from 'zod'
import type { Registry } from '../mcp.types'

export const registry: Registry = {
  get_workshop_href: {
    primitive: 'tool',
    config: {
      title: 'Get server href',
      description: 'Get Workshop root url',
      outputSchema: {
        href: z.string(),
      },
    },
  },
  get_story_routes: {
    primitive: 'tool',
    config: {
      title: 'Get story routes',
      description: 'Get a list pf the story routes',
      outputSchema: {
        routes: z.array(z.string()).describe('List of routes for running stories'),
      },
    },
  },
}
