/**
 * Agent-facing MCP client CLI for calling remote MCP servers.
 *
 * @remarks
 * Supports all 7 MCP operations: call-tool, list-tools, list-prompts,
 * get-prompt, list-resources, read-resource, and discover.
 *
 * @internal
 */

import * as z from 'zod'
import {
  mcpCallTool,
  mcpDiscover,
  mcpGetPrompt,
  mcpListPrompts,
  mcpListResources,
  mcpListTools,
  mcpReadResource,
} from '../mcp.ts'
import { makeCli } from './cli.ts'

const RemoteMcpOptionsFields = {
  auth: z
    .object({
      type: z.literal('none'),
    })
    .passthrough()
    .optional(),
  headers: z.record(z.string(), z.string()).optional(),
  timeoutMs: z.number().int().positive().optional(),
}

const CallToolModeSchema = z
  .object({
    mode: z.literal('call-tool'),
    url: z.string().min(1),
    tool: z.string().min(1),
    args: z.record(z.string(), z.unknown()),
    ...RemoteMcpOptionsFields,
  })
  .describe('Call a tool on a remote MCP server')

const ListToolsModeSchema = z
  .object({
    mode: z.literal('list-tools'),
    url: z.string().min(1),
    ...RemoteMcpOptionsFields,
  })
  .describe('List available tools from a remote MCP server')

const ListPromptsModeSchema = z
  .object({
    mode: z.literal('list-prompts'),
    url: z.string().min(1),
    ...RemoteMcpOptionsFields,
  })
  .describe('List available prompts from a remote MCP server')

const GetPromptModeSchema = z
  .object({
    mode: z.literal('get-prompt'),
    url: z.string().min(1),
    name: z.string().min(1),
    args: z.record(z.string(), z.string()).optional(),
    ...RemoteMcpOptionsFields,
  })
  .describe('Get a specific prompt from a remote MCP server')

const ListResourcesModeSchema = z
  .object({
    mode: z.literal('list-resources'),
    url: z.string().min(1),
    ...RemoteMcpOptionsFields,
  })
  .describe('List available resources from a remote MCP server')

const ReadResourceModeSchema = z
  .object({
    mode: z.literal('read-resource'),
    url: z.string().min(1),
    uri: z.string().min(1),
    ...RemoteMcpOptionsFields,
  })
  .describe('Read a resource from a remote MCP server by URI')

const DiscoverModeSchema = z
  .object({
    mode: z.literal('discover'),
    url: z.string().min(1),
    ...RemoteMcpOptionsFields,
  })
  .describe('Discover all capabilities (tools, prompts, resources) from a remote MCP server')

const McpClientInputSchema = z
  .discriminatedUnion('mode', [
    CallToolModeSchema,
    ListToolsModeSchema,
    ListPromptsModeSchema,
    GetPromptModeSchema,
    ListResourcesModeSchema,
    ReadResourceModeSchema,
    DiscoverModeSchema,
  ])
  .describe('MCP client operation to perform')

const CallToolOutputSchema = z
  .object({
    mode: z.literal('call-tool'),
    result: z
      .object({
        content: z.array(
          z
            .object({
              type: z.string(),
              text: z.string().optional(),
            })
            .passthrough(),
        ),
        isError: z.boolean().optional(),
      })
      .describe('Result from calling a tool'),
  })
  .describe('call-tool mode output')

const ListToolsOutputSchema = z.object({
  mode: z.literal('list-tools'),
  result: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        inputSchema: z.record(z.string(), z.unknown()),
      }),
    )
    .describe('List of available tools'),
})

const ListPromptsOutputSchema = z.object({
  mode: z.literal('list-prompts'),
  result: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        arguments: z
          .array(
            z.object({
              name: z.string(),
              description: z.string().optional(),
              required: z.boolean().optional(),
            }),
          )
          .optional(),
      }),
    )
    .describe('List of available prompts'),
})

const GetPromptOutputSchema = z.object({
  mode: z.literal('get-prompt'),
  result: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z
          .object({
            type: z.string(),
            text: z.string().optional(),
          })
          .passthrough(),
      }),
    )
    .describe('Prompt messages'),
})

const ListResourcesOutputSchema = z.object({
  mode: z.literal('list-resources'),
  result: z
    .array(
      z.object({
        uri: z.string(),
        name: z.string(),
        description: z.string().optional(),
        mimeType: z.string().optional(),
      }),
    )
    .describe('List of available resources'),
})

const ReadResourceOutputSchema = z.object({
  mode: z.literal('read-resource'),
  result: z
    .array(
      z.object({
        uri: z.string(),
        text: z.string().optional(),
        blob: z.string().optional(),
        mimeType: z.string().optional(),
      }),
    )
    .describe('Resource content'),
})

const DiscoverOutputSchema = z.object({
  mode: z.literal('discover'),
  result: z
    .object({
      tools: z.array(z.any()),
      prompts: z.array(z.any()),
      resources: z.array(z.any()),
    })
    .describe('All server capabilities'),
})

const McpClientOutputSchema = z
  .discriminatedUnion('mode', [
    CallToolOutputSchema,
    ListToolsOutputSchema,
    ListPromptsOutputSchema,
    GetPromptOutputSchema,
    ListResourcesOutputSchema,
    ReadResourceOutputSchema,
    DiscoverOutputSchema,
  ])
  .describe('MCP client operation result')

const run = async (input: unknown): Promise<z.infer<typeof McpClientOutputSchema>> => {
  const parsed = McpClientInputSchema.parse(input)

  switch (parsed.mode) {
    case 'call-tool':
      return {
        mode: 'call-tool',
        result: await mcpCallTool(parsed.url, parsed.tool, parsed.args, {
          timeoutMs: parsed.timeoutMs,
          headers: parsed.headers,
        }),
      }
    case 'list-tools':
      return {
        mode: 'list-tools',
        result: await mcpListTools(parsed.url, {
          timeoutMs: parsed.timeoutMs,
          headers: parsed.headers,
        }),
      }
    case 'list-prompts':
      return {
        mode: 'list-prompts',
        result: await mcpListPrompts(parsed.url, {
          timeoutMs: parsed.timeoutMs,
          headers: parsed.headers,
        }),
      }
    case 'get-prompt':
      return {
        mode: 'get-prompt',
        result: await mcpGetPrompt(parsed.url, parsed.name, parsed.args, {
          timeoutMs: parsed.timeoutMs,
          headers: parsed.headers,
        }),
      }
    case 'list-resources':
      return {
        mode: 'list-resources',
        result: await mcpListResources(parsed.url, {
          timeoutMs: parsed.timeoutMs,
          headers: parsed.headers,
        }),
      }
    case 'read-resource':
      return {
        mode: 'read-resource',
        result: await mcpReadResource(parsed.url, parsed.uri, {
          timeoutMs: parsed.timeoutMs,
          headers: parsed.headers,
        }),
      }
    case 'discover':
      return {
        mode: 'discover',
        result: await mcpDiscover(parsed.url, {
          timeoutMs: parsed.timeoutMs,
          headers: parsed.headers,
        }),
      }
  }
}

export const mcpClientCli = makeCli({
  name: 'mcp-client',
  inputSchema: McpClientInputSchema,
  outputSchema: McpClientOutputSchema,
  help: [
    'Call tools, list capabilities, and interact with remote MCP servers.',
    '',
    'Modes:',
    '  call-tool        Call a tool on a remote MCP server',
    '  list-tools       List available tools from a remote MCP server',
    '  list-prompts     List available prompts from a remote MCP server',
    '  get-prompt       Get a specific prompt from a remote MCP server',
    '  list-resources   List available resources from a remote MCP server',
    '  read-resource    Read a resource from a remote MCP server',
    '  discover         Discover all capabilities from a remote MCP server',
    '',
    'Each mode accepts the remote URL and optional auth/headers/timeoutMs fields.',
  ].join('\n'),
  run,
})
