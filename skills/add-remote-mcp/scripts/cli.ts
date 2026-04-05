import { makeCli } from 'plaited/cli'
import {
  createRemoteMcpSession,
  mcpDiscover,
  mcpGetPrompt,
  mcpListPrompts,
  mcpListResources,
  mcpListTools,
  mcpReadResource,
} from 'plaited/mcp'
import * as z from 'zod'

type AddRemoteMcpInput = z.infer<typeof AddRemoteMcpInputSchema>
type AddRemoteMcpOutput = z.infer<typeof AddRemoteMcpOutputSchema>

const AddRemoteMcpOperationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('discover'),
  }),
  z.object({
    type: z.literal('list-tools'),
  }),
  z.object({
    type: z.literal('list-prompts'),
  }),
  z.object({
    type: z.literal('list-resources'),
  }),
  z.object({
    type: z.literal('get-prompt'),
    name: z.string().min(1),
    arguments: z.record(z.string(), z.string()).optional(),
  }),
  z.object({
    type: z.literal('read-resource'),
    uri: z.string().min(1),
  }),
  z.object({
    type: z.literal('session-summary'),
  }),
])

const AddRemoteMcpInputSchema = z.object({
  url: z.string().url().describe('Remote MCP discovery or transport URL'),
  timeoutMs: z.number().int().positive().max(120_000).optional(),
  operation: AddRemoteMcpOperationSchema,
})

const AddRemoteMcpOutputSchema = z.object({
  url: z.string(),
  operation: z.string(),
  result: z.unknown(),
})

type SessionSummary = {
  prompts: unknown
  resources: unknown
  serverCapabilities: unknown
  tools: unknown
}

export { AddRemoteMcpInputSchema, AddRemoteMcpOutputSchema, addRemoteMcpCli, runAddRemoteMcp }
export type { AddRemoteMcpInput, AddRemoteMcpOutput, SessionSummary }

const getRemoteOptions = (input: AddRemoteMcpInput) =>
  input.timeoutMs === undefined
    ? undefined
    : {
        timeoutMs: input.timeoutMs,
      }

const getSessionSummary = async (input: AddRemoteMcpInput): Promise<SessionSummary> => {
  await using session = await createRemoteMcpSession(input.url, getRemoteOptions(input))
  const [serverCapabilities, tools, prompts, resources] = await Promise.all([
    session.discover(),
    session.listTools(),
    session.listPrompts(),
    session.listResources(),
  ])

  return {
    prompts,
    resources,
    serverCapabilities,
    tools,
  }
}

const runAddRemoteMcp = async (input: AddRemoteMcpInput): Promise<AddRemoteMcpOutput> => {
  const options = getRemoteOptions(input)
  const operation = input.operation

  switch (operation.type) {
    case 'discover':
      return {
        url: input.url,
        operation: operation.type,
        result: await mcpDiscover(input.url, options),
      }
    case 'list-tools':
      return {
        url: input.url,
        operation: operation.type,
        result: await mcpListTools(input.url, options),
      }
    case 'list-prompts':
      return {
        url: input.url,
        operation: operation.type,
        result: await mcpListPrompts(input.url, options),
      }
    case 'list-resources':
      return {
        url: input.url,
        operation: operation.type,
        result: await mcpListResources(input.url, options),
      }
    case 'get-prompt':
      return {
        url: input.url,
        operation: operation.type,
        result: await mcpGetPrompt(input.url, operation.name, operation.arguments ?? {}, options),
      }
    case 'read-resource':
      return {
        url: input.url,
        operation: operation.type,
        result: await mcpReadResource(input.url, operation.uri, options),
      }
    case 'session-summary':
      return {
        url: input.url,
        operation: operation.type,
        result: await getSessionSummary(input),
      }
  }
}

const addRemoteMcpCli = makeCli({
  name: 'add-remote-mcp',
  inputSchema: AddRemoteMcpInputSchema,
  outputSchema: AddRemoteMcpOutputSchema,
  help: [
    'Examples:',
    `  bun skills/add-remote-mcp/scripts/run.ts '{"url":"https://bun.com/docs/mcp","operation":{"type":"discover"}}'`,
    `  bun skills/add-remote-mcp/scripts/run.ts '{"url":"https://bun.com/docs/mcp","operation":{"type":"session-summary"}}'`,
  ].join('\n'),
  run: runAddRemoteMcp,
})
