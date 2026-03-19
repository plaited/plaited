#!/usr/bin/env bun

import * as z from 'zod'
import {
  McpCallToolInputSchema,
  McpCallToolResultSchema,
  McpDiscoverInputSchema,
  McpGetPromptInputSchema,
  McpListPromptsInputSchema,
  McpListResourcesInputSchema,
  McpListToolsInputSchema,
  McpPromptMessageSchema,
  McpPromptSchema,
  McpReadResourceInputSchema,
  McpResourceContentSchema,
  McpResourceSchema,
  McpServerCapabilitiesSchema,
  McpToolSchema,
} from './mcp.schemas.ts'
import {
  mcpCallTool,
  mcpDiscover,
  mcpGetPrompt,
  mcpListPrompts,
  mcpListResources,
  mcpListTools,
  mcpReadResource,
} from './mcp.utils.ts'

const MCP_SUBCOMMANDS = [
  'discover',
  'list-tools',
  'call',
  'list-prompts',
  'get-prompt',
  'list-resources',
  'read-resource',
] as const

type McpSubcommand = (typeof MCP_SUBCOMMANDS)[number]

const printHelp = (subcommand?: McpSubcommand) => {
  const common = [
    'Usage: plaited mcp <subcommand> ... [--headers <json>] [--timeout <ms>]',
    '',
    'Subcommands:',
    '  discover <url>',
    '  list-tools <url>',
    '  call <url> <tool> <json-args>',
    '  list-prompts <url>',
    '  get-prompt <url> <name> [json-args]',
    '  list-resources <url>',
    '  read-resource <url> <uri>',
  ]

  if (!subcommand) {
    console.error(common.join('\n'))
    return
  }

  const usageByCommand: Record<McpSubcommand, string> = {
    discover: 'Usage: plaited mcp discover <url> [--headers <json>] [--timeout <ms>]',
    'list-tools': 'Usage: plaited mcp list-tools <url> [--headers <json>] [--timeout <ms>]',
    call: 'Usage: plaited mcp call <url> <tool> <json-args> [--headers <json>] [--timeout <ms>]',
    'list-prompts': 'Usage: plaited mcp list-prompts <url> [--headers <json>] [--timeout <ms>]',
    'get-prompt': 'Usage: plaited mcp get-prompt <url> <name> [json-args] [--headers <json>] [--timeout <ms>]',
    'list-resources': 'Usage: plaited mcp list-resources <url> [--headers <json>] [--timeout <ms>]',
    'read-resource': 'Usage: plaited mcp read-resource <url> <uri> [--headers <json>] [--timeout <ms>]',
  }
  console.error(usageByCommand[subcommand])
}

const parseHeaders = (raw: string | undefined) => {
  if (!raw) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.error('Invalid JSON for --headers')
    process.exit(2)
  }
  const result = z.record(z.string(), z.string()).safeParse(parsed)
  if (!result.success) {
    console.error(JSON.stringify(result.error.issues, null, 2))
    process.exit(2)
  }
  return result.data
}

const parseTimeout = (raw: string | undefined) => {
  if (!raw) return undefined
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.error('Invalid --timeout value')
    process.exit(2)
  }
  return parsed
}

const parseJsonRecord = (raw: string | undefined, label: string) => {
  if (!raw) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.error(`Invalid JSON for ${label}`)
    process.exit(2)
  }
  const result = z.record(z.string(), z.unknown()).safeParse(parsed)
  if (!result.success) {
    console.error(JSON.stringify(result.error.issues, null, 2))
    process.exit(2)
  }
  return result.data
}

const parseStringRecord = (raw: string | undefined, label: string) => {
  if (!raw) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.error(`Invalid JSON for ${label}`)
    process.exit(2)
  }
  const result = z.record(z.string(), z.string()).safeParse(parsed)
  if (!result.success) {
    console.error(JSON.stringify(result.error.issues, null, 2))
    process.exit(2)
  }
  return result.data
}

const parseFlags = (args: string[]) => {
  const positionals: string[] = []
  let headersRaw: string | undefined
  let timeoutRaw: string | undefined
  let schemaTarget: 'input' | 'output' | undefined

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === undefined) continue
    if (arg === '--headers') {
      headersRaw = args[index + 1]
      index += 1
      continue
    }
    if (arg === '--timeout') {
      timeoutRaw = args[index + 1]
      index += 1
      continue
    }
    if (arg === '--schema') {
      const target = args[index + 1]
      if (target === 'input' || target === 'output') {
        schemaTarget = target
        index += 1
        continue
      }
      console.error("Expected 'input' or 'output' after --schema")
      process.exit(2)
    }
    if (arg === '--help' || arg === '-h') {
      positionals.push(arg)
      continue
    }
    positionals.push(arg)
  }

  return {
    positionals,
    headers: parseHeaders(headersRaw),
    timeoutMs: parseTimeout(timeoutRaw),
    schemaTarget,
  }
}

const printSchema = (schema: z.ZodSchema) => {
  console.log(JSON.stringify(z.toJSONSchema(schema), null, 2))
}

const printJson = (value: unknown) => {
  console.log(JSON.stringify(value, null, 2))
}

export const mcpCli = async (args: string[]): Promise<void> => {
  const subcommand = args[0] as McpSubcommand | undefined

  if (!subcommand || args.includes('--help') || args.includes('-h')) {
    if (subcommand && MCP_SUBCOMMANDS.includes(subcommand)) {
      printHelp(subcommand)
      process.exit(0)
    }
    printHelp()
    process.exit(subcommand ? 0 : 1)
  }

  if (!MCP_SUBCOMMANDS.includes(subcommand)) {
    console.error(`Unknown mcp subcommand: ${subcommand}`)
    printHelp()
    process.exit(1)
  }

  const { positionals, headers, timeoutMs, schemaTarget } = parseFlags(args.slice(1))
  const options = { headers, timeoutMs }

  switch (subcommand) {
    case 'discover': {
      if (schemaTarget) {
        printSchema(schemaTarget === 'input' ? McpDiscoverInputSchema : McpServerCapabilitiesSchema)
        return
      }
      const parsed = McpDiscoverInputSchema.safeParse({ url: positionals[0], ...options })
      if (!parsed.success) {
        console.error(JSON.stringify(parsed.error.issues, null, 2))
        process.exit(2)
      }
      printJson(McpServerCapabilitiesSchema.parse(await mcpDiscover(parsed.data.url, options)))
      return
    }
    case 'list-tools': {
      if (schemaTarget) {
        printSchema(schemaTarget === 'input' ? McpListToolsInputSchema : z.array(McpToolSchema))
        return
      }
      const parsed = McpListToolsInputSchema.safeParse({ url: positionals[0], ...options })
      if (!parsed.success) {
        console.error(JSON.stringify(parsed.error.issues, null, 2))
        process.exit(2)
      }
      printJson(z.array(McpToolSchema).parse(await mcpListTools(parsed.data.url, options)))
      return
    }
    case 'call': {
      if (schemaTarget) {
        printSchema(schemaTarget === 'input' ? McpCallToolInputSchema : McpCallToolResultSchema)
        return
      }
      const parsed = McpCallToolInputSchema.safeParse({
        url: positionals[0],
        toolName: positionals[1],
        args: parseJsonRecord(positionals[2], 'tool arguments'),
        ...options,
      })
      if (!parsed.success) {
        console.error(JSON.stringify(parsed.error.issues, null, 2))
        process.exit(2)
      }
      printJson(
        McpCallToolResultSchema.parse(
          await mcpCallTool(parsed.data.url, parsed.data.toolName, parsed.data.args, options),
        ),
      )
      return
    }
    case 'list-prompts': {
      if (schemaTarget) {
        printSchema(schemaTarget === 'input' ? McpListPromptsInputSchema : z.array(McpPromptSchema))
        return
      }
      const parsed = McpListPromptsInputSchema.safeParse({ url: positionals[0], ...options })
      if (!parsed.success) {
        console.error(JSON.stringify(parsed.error.issues, null, 2))
        process.exit(2)
      }
      printJson(z.array(McpPromptSchema).parse(await mcpListPrompts(parsed.data.url, options)))
      return
    }
    case 'get-prompt': {
      if (schemaTarget) {
        printSchema(schemaTarget === 'input' ? McpGetPromptInputSchema : z.array(McpPromptMessageSchema))
        return
      }
      const parsed = McpGetPromptInputSchema.safeParse({
        url: positionals[0],
        name: positionals[1],
        args: parseStringRecord(positionals[2], 'prompt arguments'),
        ...options,
      })
      if (!parsed.success) {
        console.error(JSON.stringify(parsed.error.issues, null, 2))
        process.exit(2)
      }
      printJson(
        z
          .array(McpPromptMessageSchema)
          .parse(await mcpGetPrompt(parsed.data.url, parsed.data.name, parsed.data.args, options)),
      )
      return
    }
    case 'list-resources': {
      if (schemaTarget) {
        printSchema(schemaTarget === 'input' ? McpListResourcesInputSchema : z.array(McpResourceSchema))
        return
      }
      const parsed = McpListResourcesInputSchema.safeParse({ url: positionals[0], ...options })
      if (!parsed.success) {
        console.error(JSON.stringify(parsed.error.issues, null, 2))
        process.exit(2)
      }
      printJson(z.array(McpResourceSchema).parse(await mcpListResources(parsed.data.url, options)))
      return
    }
    case 'read-resource': {
      if (schemaTarget) {
        printSchema(schemaTarget === 'input' ? McpReadResourceInputSchema : z.array(McpResourceContentSchema))
        return
      }
      const parsed = McpReadResourceInputSchema.safeParse({
        url: positionals[0],
        uri: positionals[1],
        ...options,
      })
      if (!parsed.success) {
        console.error(JSON.stringify(parsed.error.issues, null, 2))
        process.exit(2)
      }
      printJson(
        z.array(McpResourceContentSchema).parse(await mcpReadResource(parsed.data.url, parsed.data.uri, options)),
      )
    }
  }
}
