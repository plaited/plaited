import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Registry } from '../mcp.types'
import { defineMCPServer } from '../define-mcp-server.js'

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
      outputSchema: {
        value: z.number(),
      },
    },
  },
} satisfies Registry
const server = await defineMCPServer({
  name: 'plaited-workshop',
  version: '0.0.1',
  registry,
  async bProgram() {
    return {
      prompt({ resolve, args }) {
        resolve({
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Please review this code:\n\n${args.code}`,
              },
            },
          ],
        })
      },
      resource({ args, resolve }) {
        const [uri] = args
        resolve({
          contents: [
            {
              uri: uri.href,
              text: 'App configuration here',
            },
          ],
        })
      },
      resourceTemplate({ args, resolve }) {
        const [uri, vars] = args
        resolve({
          contents: [
            {
              uri: uri.href,
              text: `Repository: ${vars.owner}/${vars.repo}`,
            },
          ],
        })
      },
      tool({ args, resolve }) {
        resolve({
          content: [{ type: 'text', text: String(args.a + args.b) }],
        })
      },
    }
  },
})
const transport = new StdioServerTransport()
await server.connect(transport)
