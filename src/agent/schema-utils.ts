/**
 * Utilities for converting Zod schemas to tool schemas.
 *
 * @remarks
 * Provides helpers to bridge Zod 4.x schemas with the ToolSchema format
 * used by FunctionGemma and other LLM providers.
 *
 * @module
 */

import { z } from 'zod'
import type { ToolSchema } from './agent.types.ts'

/**
 * Options for converting a Zod schema to a ToolSchema.
 */
export type ZodToToolSchemaOptions = {
  /** Tool name (used for invocation) */
  name: string
  /** Human-readable description of what the tool does */
  description: string
  /** Zod object schema defining the tool's parameters */
  schema: z.ZodObject<z.ZodRawShape>
}

/**
 * Converts a Zod object schema to a ToolSchema for LLM function calling.
 *
 * @remarks
 * Uses Zod 4.x's built-in `z.toJSONSchema()` for conversion.
 * The resulting schema follows the OpenAI function calling format,
 * compatible with FunctionGemma and other LLM providers.
 *
 * The Zod schema's `.describe()` calls are preserved in the JSON Schema
 * as `description` fields for each property.
 */
export const zodToToolSchema = ({ name, description, schema }: ZodToToolSchemaOptions): ToolSchema => {
  const jsonSchema = z.toJSONSchema(schema)

  // Extract required fields from Zod schema
  const required: string[] = []
  const shape = schema.shape
  for (const key of Object.keys(shape)) {
    const field = shape[key]
    // Check if the field is NOT optional (not wrapped in ZodOptional)
    if (field && !(field instanceof z.ZodOptional)) {
      required.push(key)
    }
  }

  return {
    name,
    description,
    parameters: {
      type: 'object',
      properties: (jsonSchema.properties ?? {}) as Record<string, unknown>,
      ...(required.length > 0 && { required }),
    },
  }
}
