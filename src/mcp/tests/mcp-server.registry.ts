import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Registry } from '../mcp.types'

export const registry = {
  prompt: {
    primitive: 'prompt',
    config: {
      title: 'Code Review',
      description: 'Review code for best practices and potential issues',
      argsSchema: { code: z.string() },
    },
  },
  resource: {
    primitive: 'resource',
    config: {
      uriOrTemplate: 'config://app',
      metaData: {
        title: 'Application Config',
        description: 'Application configuration data',
        mimeType: 'text/plain',
      },
    },
  },
  resourceTemplate: {
    primitive: 'resource',
    config: {
      uriOrTemplate: new ResourceTemplate('github://repos/{owner}/{repo}', {
        list: undefined,
        complete: {
          // Provide intelligent completions based on previously resolved parameters
          repo: (value, context) => {
            if (context?.arguments?.['owner'] === 'org1') {
              return ['project1', 'project2', 'project3'].filter((r) => r.startsWith(value))
            }
            return ['default-repo'].filter((r) => r.startsWith(value))
          },
        },
      }),
      metaData: {
        title: 'GitHub Repository',
        description: 'Repository information',
      },
    },
  },
  tool: {
    primitive: 'tool',
    config: {
      title: 'Addition Tool',
      description: 'Add two numbers',
      inputSchema: { a: z.number(), b: z.number() },
    },
  },
} satisfies Registry
