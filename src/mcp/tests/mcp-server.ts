import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { defineMCPServer } from '../define-mcp-server.js'
import { registry } from './mcp-server.registry.js'

const server = await defineMCPServer({
  name: 'test-server',
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
