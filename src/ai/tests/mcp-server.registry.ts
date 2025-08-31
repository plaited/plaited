import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { usePrompt, useResource, useTool } from '../b-server.utils.js'

export const registry = {
  prompt: usePrompt({
    title: 'Code Review',
    description: 'Review code for best practices and potential issues',
    argsSchema: { code: z.string() },
    handler({ resolve, args }) {
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
  }),
  resource: useResource({
    metaData: {
      title: 'Application Config',
      description: 'Application configuration data',
      mimeType: 'text/plain',
    },
    uriOrTemplate: 'config://app',
    handler({ args, resolve }) {
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
  }),
  resourceTemplate: useResource({
    metaData: {
      title: 'GitHub Repository',
      description: 'Repository information',
    },
    uriOrTemplate: new ResourceTemplate('github://repos/{owner}/{repo}', {
      list: undefined,
      complete: {
        repo: (value, context) => {
          if (context?.arguments?.['owner'] === 'org1') {
            return ['project1', 'project2', 'project3'].filter((r) => r.startsWith(value))
          }
          return ['default-repo'].filter((r) => r.startsWith(value))
        },
      },
    }),
    handler({ args, resolve }) {
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
  }),
  tool: useTool({
    title: 'Addition Tool',
    description: 'Add two numbers',
    inputSchema: { a: z.number(), b: z.number() },
    handler({ args, resolve }) {
      resolve({
        content: [{ type: 'text', text: `${args.a + args.b}` }],
      })
    },
  }),
}
