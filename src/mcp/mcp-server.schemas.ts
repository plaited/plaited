import { z } from 'zod'

export const TOOL_REGISTRY = {
  get_workshop_href: {
    title: 'Get server href',
    description: 'Get Workshop root url',
    outputSchema: {
      href: z.string(),
    },
  },
  get_story_routes: {
    title: 'Get story routes',
    description: 'Get a list pf the story routes',
    outputSchema: {
      routes: z.array(z.string()).describe('List of routes for running stories'),
    },
  },
}
