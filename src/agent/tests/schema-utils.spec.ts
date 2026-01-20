import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { zodToToolSchema } from '../schema-utils.ts'

// ============================================================================
// zodToToolSchema Tests
// ============================================================================

describe('zodToToolSchema', () => {
  test('converts basic Zod schema to ToolSchema', () => {
    const schema = z.object({
      name: z.string().describe('The name of the item'),
      count: z.number().describe('The count'),
    })

    const toolSchema = zodToToolSchema({
      name: 'testTool',
      description: 'A test tool',
      schema,
    })

    expect(toolSchema.name).toBe('testTool')
    expect(toolSchema.description).toBe('A test tool')
    expect(toolSchema.parameters.type).toBe('object')
    expect(toolSchema.parameters.properties).toBeDefined()
    expect(toolSchema.parameters.required).toContain('name')
    expect(toolSchema.parameters.required).toContain('count')
  })

  test('handles optional fields correctly', () => {
    const schema = z.object({
      required: z.string().describe('Required field'),
      optional: z.string().optional().describe('Optional field'),
    })

    const toolSchema = zodToToolSchema({
      name: 'optionalTool',
      description: 'Tool with optional fields',
      schema,
    })

    expect(toolSchema.parameters.required).toContain('required')
    expect(toolSchema.parameters.required).not.toContain('optional')
  })

  test('handles nested objects', () => {
    const schema = z.object({
      config: z.object({
        enabled: z.boolean(),
        value: z.number(),
      }),
    })

    const toolSchema = zodToToolSchema({
      name: 'nestedTool',
      description: 'Tool with nested config',
      schema,
    })

    expect(toolSchema.parameters.properties).toHaveProperty('config')
  })

  test('handles arrays', () => {
    const schema = z.object({
      items: z.array(z.string()).describe('List of items'),
    })

    const toolSchema = zodToToolSchema({
      name: 'arrayTool',
      description: 'Tool with array parameter',
      schema,
    })

    expect(toolSchema.parameters.properties).toHaveProperty('items')
  })

  test('handles empty required array when all fields optional', () => {
    const schema = z.object({
      a: z.string().optional(),
      b: z.number().optional(),
    })

    const toolSchema = zodToToolSchema({
      name: 'allOptional',
      description: 'All fields are optional',
      schema,
    })

    // required should be undefined or empty
    expect(toolSchema.parameters.required ?? []).toHaveLength(0)
  })

  test('preserves descriptions from Zod schema', () => {
    const schema = z.object({
      path: z.string().describe('File path to read'),
    })

    const toolSchema = zodToToolSchema({
      name: 'readFile',
      description: 'Read a file',
      schema,
    })

    const pathProp = toolSchema.parameters.properties.path as { description?: string }
    expect(pathProp.description).toBe('File path to read')
  })
})
