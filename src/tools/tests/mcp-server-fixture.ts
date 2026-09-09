import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import type { ZodRawShapeCompat } from '@modelcontextprotocol/sdk/server/zod-compat.js'
import { z } from 'zod'

/**
 * Spin a real in-process MCP server over loopback HTTP and return its URL +
 * a close hook. Backs MCP client tool tests with a real SDK server + real
 * HTTP transport rather than mocking the client SDK.
 */
export const startMcpServer = async (): Promise<{ url: string; close: () => Promise<void> }> => {
  // Sessionful mode: one transport instance serves many requests across
  // sessions. The client opens one session and reuses it for every mode call.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    enableJsonResponse: true,
  })

  const server = new McpServer({ name: 'behavioral-test-server', version: '0.0.0' })

  // MINIMAL: the SDK's registerTool/registerPrompt argsSchema accepts a Zod
  // raw shape, but the installed zod (v4) optional schemas don't statically
  // satisfy the SDK's AnySchema union under verbatimModuleSyntax. Cast the
  // small shapes through the SDK's compat type — these are test fixtures, not
  // framework code.
  const echoShape = { message: z.string().optional() } as unknown as ZodRawShapeCompat
  const greetShape = { name: z.string().optional() } as unknown as ZodRawShapeCompat

  server.registerTool(
    'echo',
    { description: 'Echo back the message argument as text.', inputSchema: echoShape },
    async (args: { message?: string }) => ({
      content: [{ type: 'text', text: `echo:${args.message ?? ''}` }],
    }),
  )

  server.registerPrompt(
    'greet',
    { description: 'A greeting prompt.', argsSchema: greetShape },
    async (args: { name?: string }) => ({
      messages: [{ role: 'user', content: { type: 'text', text: `hello ${args.name ?? 'world'}` } }],
    }),
  )

  server.registerResource(
    'note',
    'test://note',
    { description: 'A short note resource.', mimeType: 'text/plain' },
    async () => ({
      contents: [{ uri: 'test://note', mimeType: 'text/plain', text: 'a note' }],
    }),
  )

  await server.connect(transport)

  const httpServer = Bun.serve({
    port: 0,
    fetch: async (request) => transport.handleRequest(request),
  })

  return {
    url: `http://localhost:${httpServer.port}/mcp`,
    close: async () => {
      httpServer.stop(true)
      try {
        await server.close()
      } catch {
        /* best-effort */
      }
    },
  }
}
