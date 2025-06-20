import type { z } from 'zod'

// Simple utility to convert basic Zod schemas to JSON Schema for MCP
export function zodToJsonSchema(schema: z.ZodType): any {
  // This is a simplified conversion for the specific schemas we're using
  // A full implementation would handle all Zod types
  
  const def = schema._def as any
  
  if (def.typeName === 'ZodObject') {
    const shape = def.shape()
    const properties: Record<string, any> = {}
    const required: string[] = []
    
    for (const [key, value] of Object.entries(shape)) {
      const fieldSchema = value as z.ZodType
      const fieldDef = fieldSchema._def as any
      
      if (fieldDef.typeName === 'ZodString') {
        properties[key] = { type: 'string' }
        required.push(key)
      } else if (fieldDef.typeName === 'ZodBoolean') {
        properties[key] = { type: 'boolean' }
        required.push(key)
      } else if (fieldDef.typeName === 'ZodNumber') {
        properties[key] = { type: 'number' }
        required.push(key)
      } else if (fieldDef.typeName === 'ZodArray') {
        properties[key] = { 
          type: 'array',
          items: { type: 'string' } // Simplified for our use case
        }
        required.push(key)
      } else if (fieldDef.typeName === 'ZodEnum') {
        properties[key] = {
          type: 'string',
          enum: fieldDef.values
        }
        required.push(key)
      } else if (fieldDef.typeName === 'ZodOptional') {
        const innerSchema = fieldDef.innerType
        const innerDef = innerSchema._def as any
        if (innerDef.typeName === 'ZodString') {
          properties[key] = { type: 'string' }
        } else if (innerDef.typeName === 'ZodBoolean') {
          properties[key] = { type: 'boolean' }
        }
        // Optional fields are not added to required array
      } else if (fieldDef.typeName === 'ZodDefault') {
        const innerSchema = fieldDef.innerType
        const innerDef = innerSchema._def as any
        if (innerDef.typeName === 'ZodBoolean') {
          properties[key] = { 
            type: 'boolean',
            default: fieldDef.defaultValue()
          }
        } else if (innerDef.typeName === 'ZodNumber') {
          properties[key] = { 
            type: 'number',
            default: fieldDef.defaultValue()
          }
        } else if (innerDef.typeName === 'ZodEnum') {
          properties[key] = {
            type: 'string',
            enum: innerDef.values,
            default: fieldDef.defaultValue()
          }
        }
        // Default fields are not required
      }
    }
    
    return {
      type: 'object',
      properties,
      required,
      additionalProperties: false
    }
  }
  
  // Fallback for unsupported types
  return { type: 'object' }
}