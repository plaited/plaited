import { z } from 'zod'
import type {
  McpServer,
  ResourceMetadata,
  ResourceTemplate,
  RegisteredTool,
  RegisteredPrompt,
  RegisteredResource,
  RegisteredResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js'
import type { GetPromptResult, ReadResourceResult, CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { EventDetails } from '../behavioral.js'

export type BPEventTypesToToolConfigs<T extends Record<string, string>> = {
  readonly [K in keyof T]: Parameters<McpServer['registerTool']>[1]
}

export type PromptConfig = Parameters<McpServer['registerPrompt']>[1]

export type ResourceConfig = {
  metaData: ResourceMetadata
  uriOrTemplate: string | ResourceTemplate
}

export type ToolConfig = Parameters<McpServer['registerTool']>[1]

export type PromptEntry = {
  primitive: 'prompt'
  config: PromptConfig
}

export type ResourceEntry = {
  primitive: 'resource'
  config: ResourceConfig
}

export type ToolEntry = {
  primitive: 'tool'
  config: ToolConfig
}

export type Registry = {
  [k: string]: PromptEntry | ResourceEntry | ToolEntry
}

export type PromptDetail<T extends PromptEntry['config']['argsSchema']> = {
  resolve: ReturnType<typeof Promise.withResolvers<GetPromptResult>>['resolve']
  reject: ReturnType<typeof Promise.withResolvers<GetPromptResult>>['reject']
  args: T extends z.ZodRawShape ? z.infer<z.ZodObject<T>> : T
}

export type ResourceDetail<T extends ResourceEntry['config']['uriOrTemplate']> = {
  resolve: ReturnType<typeof Promise.withResolvers<ReadResourceResult>>['resolve']
  reject: ReturnType<typeof Promise.withResolvers<ReadResourceResult>>['reject']
  args: T extends string ? [URL] : [URL, Record<string, string | string[]>]
}

export type ToolDetail<T extends ToolEntry['config']['inputSchema']> = {
  resolve: ReturnType<typeof Promise.withResolvers<CallToolResult>>['resolve']
  reject: ReturnType<typeof Promise.withResolvers<CallToolResult>>['reject']
  args: T extends z.ZodRawShape ? z.infer<z.ZodObject<T>> : T
}

type HandlerCallback<Entry extends PromptEntry | ResourceEntry | ToolEntry> =
  Entry extends PromptEntry ? (detail: PromptDetail<Entry['config']['argsSchema']>) => void | Promise<void>
  : Entry extends ResourceEntry ? (detail: ResourceDetail<Entry['config']['uriOrTemplate']>) => void | Promise<void>
  : Entry extends ToolEntry ? (detail: ToolDetail<Entry['config']['inputSchema']>) => void | Promise<void>
  : (detail: { args: unknown }) => void | Promise<void>

export type StrictHandlers<Details extends EventDetails = EventDetails> = {
  [K in keyof Details]: (detail: Details[K]) => void | Promise<void>
}

export type PrimitiveHandlers<Entries extends Registry, E extends EventDetails> = {
  [P in keyof Entries | keyof E]: P extends keyof Entries ? HandlerCallback<Entries[P]>
  : P extends keyof E ? (detail: E[P]) => void | Promise<void>
  : never
}

export type Prompts<Entries extends Registry = Registry> = {
  [K in keyof Entries]: Entries[K] extends PromptEntry ? RegisteredPrompt : unknown
}

export type Resources<Entries extends Registry = Registry> = {
  [K in keyof Entries]: Entries[K] extends ResourceEntry ?
    Entries[K]['config']['uriOrTemplate'] extends ResourceTemplate ? RegisteredResourceTemplate
    : Entries[K]['config']['uriOrTemplate'] extends string ? RegisteredResource
    : unknown
  : unknown
}
export type Tools<Entries extends Registry = Registry> = {
  [K in keyof Entries]: Entries[K] extends ToolEntry ? RegisteredTool : unknown
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
