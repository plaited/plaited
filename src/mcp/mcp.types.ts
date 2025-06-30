import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export type BPEventTypesToToolConfigs<T extends Record<string, string>> = {
  readonly [K in keyof T]: Parameters<McpServer['registerTool']>[1]
}

export type ToolInputSchemaToEventDetails<T extends Record<string, unknown>> = {
  readonly [K in keyof T]: {
    input: T[K] extends { inputSchema: infer S } ?
      S extends z.ZodRawShape ?
        z.infer<z.ZodObject<S>>
      : unknown
    : unknown
    ref: string
  }
}
