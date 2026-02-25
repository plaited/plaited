/**
 * Generic output parser for headless CLI agents.
 *
 * @remarks
 * Uses schema-defined mappings to convert CLI JSON output into session updates.
 * Supports JSONPath-like expressions for matching and extraction.
 *
 * @packageDocumentation
 */

import type { HeadlessAdapterConfig, OutputEventMapping, PassthroughTypeMap } from './headless.schemas.ts'

// ============================================================================
// Types
// ============================================================================

/** session update types */
export type SessionUpdateType = 'thought' | 'tool_call' | 'message' | 'plan'

/** Parsed session update from CLI output */
export type ParsedUpdate = {
  type: SessionUpdateType
  content?: string
  title?: string
  status?: string
  input?: unknown
  output?: unknown
  timestamp: number
  raw: unknown
}

/** Result extraction from CLI output */
export type ParsedResult = {
  isResult: true
  content: string
  raw: unknown
}

/** Not a result */
export type NotResult = {
  isResult: false
}

/** Parse result for final output */
export type ResultParseResult = ParsedResult | NotResult

// ============================================================================
// JSONPath Implementation
// ============================================================================

/**
 * Extracts a value from an object using a simple JSONPath expression.
 *
 * @remarks
 * Supports:
 * - `$.field` - Root field access
 * - `$.nested.field` - Nested field access
 * - `$.array[0]` - Array index access
 * - `$.array[*]` - Array wildcard (returns all items)
 * - `$.array[0].field` - Combined array and field access
 * - `'literal'` - Literal string values (single quotes)
 *
 * @param obj - Object to extract from
 * @param path - JSONPath expression
 * @returns Extracted value, array of values (for wildcard), or undefined
 */
export const jsonPath = (obj: unknown, path: string): unknown => {
  // Handle literal strings (e.g., "'pending'")
  if (path.startsWith("'") && path.endsWith("'")) {
    return path.slice(1, -1)
  }

  // Handle JSONPath expressions (e.g., "$.type", "$.message.content[0].text")
  if (!path.startsWith('$.')) {
    return undefined
  }

  // Parse path into segments, handling both dot notation and array indices
  // e.g., "message.content[0].text" -> ["message", "content", 0, "text"]
  // e.g., "message.content[*].type" -> ["message", "content", "*", "type"]
  const segments: (string | number | '*')[] = []
  const pathBody = path.slice(2) // Remove "$."

  // Split by dots first, then handle array indices within each part
  for (const part of pathBody.split('.')) {
    if (!part) continue

    // Check for array wildcard: "content[*]"
    const wildcardMatch = part.match(/^([^[]*)\[\*\]$/)
    if (wildcardMatch) {
      const propName = wildcardMatch[1]
      if (propName) {
        segments.push(propName)
      }
      segments.push('*')
      continue
    }

    // Check for array index: "content[0]" or just "[0]"
    const arrayMatch = part.match(/^([^[]*)\[(\d+)\]$/)
    if (arrayMatch) {
      const propName = arrayMatch[1]
      const indexStr = arrayMatch[2]
      if (propName) {
        segments.push(propName)
      }
      if (indexStr) {
        segments.push(parseInt(indexStr, 10))
      }
    } else {
      segments.push(part)
    }
  }

  let current: unknown = obj

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined
    }

    if (segment === '*') {
      // Array wildcard - return array as-is for further processing
      if (!Array.isArray(current)) {
        return undefined
      }
      return current
    } else if (typeof segment === 'number') {
      // Array index access
      if (!Array.isArray(current)) {
        return undefined
      }
      current = current[segment]
    } else {
      // Property access
      if (typeof current !== 'object') {
        return undefined
      }
      current = (current as Record<string, unknown>)[segment]
    }
  }

  return current
}

/**
 * Extracts a string value from an object using JSONPath.
 *
 * @param obj - Object to extract from
 * @param path - JSONPath expression
 * @returns String value or undefined
 */
export const jsonPathString = (obj: unknown, path: string): string | undefined => {
  const value = jsonPath(obj, path)
  if (value === undefined || value === null) {
    return undefined
  }
  return String(value)
}

// ============================================================================
// Output Parser Factory
// ============================================================================

/**
 * Parse line using passthrough mode.
 *
 * @remarks
 * Passthrough mode directly maps the agent's type field to session update types.
 * Simpler than JSONPath for agents with well-structured output.
 *
 * @param line - JSON string from CLI stdout
 * @param typeMap - Passthrough type mapping configuration
 * @returns Parsed update or null if no mapping matches
 */
const parsePassthrough = (line: string, typeMap: PassthroughTypeMap): ParsedUpdate | null => {
  let event: Record<string, unknown>
  try {
    event = JSON.parse(line) as Record<string, unknown>
  } catch {
    return null
  }

  const typeField = typeMap.typeField ?? 'type'
  const eventType = event[typeField]

  if (typeof eventType !== 'string') {
    return null
  }

  // Check if this type has a mapping
  const typeValues = typeMap.typeValues as Record<string, SessionUpdateType> | undefined
  const mappedType = typeValues?.[eventType]
  if (!mappedType) {
    // No explicit mapping - try direct match if it's a valid session type
    const validTypes = ['thought', 'tool_call', 'message', 'plan'] as const
    if (!validTypes.includes(eventType as (typeof validTypes)[number])) {
      return null
    }
    // Use the event type directly if it's already a valid session type
    return {
      type: eventType as SessionUpdateType,
      content: typeof event.content === 'string' ? event.content : undefined,
      title: typeof event.name === 'string' ? event.name : typeof event.title === 'string' ? event.title : undefined,
      status: typeof event.status === 'string' ? event.status : undefined,
      input: event.input,
      output: event.output,
      timestamp: Date.now(),
      raw: event,
    }
  }

  // Use mapped type
  return {
    type: mappedType,
    content: typeof event.content === 'string' ? event.content : undefined,
    title: typeof event.name === 'string' ? event.name : typeof event.title === 'string' ? event.title : undefined,
    status: typeof event.status === 'string' ? event.status : undefined,
    input: event.input,
    output: event.output,
    timestamp: Date.now(),
    raw: event,
  }
}

/**
 * Creates an output parser from adapter configuration.
 *
 * @remarks
 * The parser uses the schema's outputEvents mappings to:
 * 1. Match incoming JSON lines against patterns
 * 2. Extract content using JSONPath expressions
 * 3. Emit session update objects
 *
 * Supports two modes:
 * - 'jsonpath' (default): Uses outputEvents for complex pattern matching
 * - 'passthrough': Direct type mapping for well-structured output
 *
 * @param config - Headless adapter configuration
 * @returns Parser function for individual lines
 */
export const createOutputParser = (config: HeadlessAdapterConfig) => {
  const { result, outputMode = 'jsonpath', outputEvents = [], passthroughTypeMap } = config

  /**
   * Parses a single JSON line from CLI output.
   *
   * @param line - JSON string from CLI stdout
   * @returns Parsed update, array of updates (for wildcard matches), or null if no mapping matches
   */
  const parseLine = (line: string): ParsedUpdate | ParsedUpdate[] | null => {
    // Use passthrough mode if configured
    if (outputMode === 'passthrough' && passthroughTypeMap) {
      return parsePassthrough(line, passthroughTypeMap)
    }

    // JSONPath mode (default)
    if (!outputEvents || outputEvents.length === 0) {
      return null
    }

    let event: unknown
    try {
      event = JSON.parse(line)
    } catch {
      // Not valid JSON, skip
      return null
    }

    // Try each mapping until one matches
    for (const mapping of outputEvents) {
      const matchValue = jsonPath(event, mapping.match.path)

      // Handle array results from wildcard paths (e.g., $.message.content[*])
      if (Array.isArray(matchValue)) {
        const updates: ParsedUpdate[] = []
        for (const item of matchValue) {
          // Check if this array item matches the expected value
          if (mapping.match.value === '*') {
            // Wildcard: match any non-null item
            if (item !== undefined && item !== null) {
              updates.push(createUpdate(item, mapping))
            }
          } else if (typeof item === 'object' && item !== null && 'type' in item) {
            // For objects with 'type' property, check nested match
            const itemType = (item as Record<string, unknown>).type
            if (itemType === mapping.match.value) {
              updates.push(createUpdate(item, mapping))
            }
          } else if (item === mapping.match.value) {
            // For primitives, direct match
            updates.push(createUpdate(item, mapping))
          }
        }
        if (updates.length > 0) {
          return updates
        }
      } else {
        // Single value matching (original behavior)
        if (mapping.match.value === '*') {
          if (matchValue !== undefined && matchValue !== null) {
            return createUpdate(event, mapping)
          }
        } else if (matchValue === mapping.match.value) {
          return createUpdate(event, mapping)
        }
      }
    }

    return null
  }

  /**
   * Creates a ParsedUpdate from a matched event.
   */
  const createUpdate = (event: unknown, mapping: OutputEventMapping): ParsedUpdate => {
    const update: ParsedUpdate = {
      type: mapping.emitAs,
      timestamp: Date.now(),
      raw: event,
    }

    if (mapping.extract) {
      if (mapping.extract.content) {
        update.content = jsonPathString(event, mapping.extract.content)
      }
      if (mapping.extract.title) {
        update.title = jsonPathString(event, mapping.extract.title)
      }
      if (mapping.extract.status) {
        update.status = jsonPathString(event, mapping.extract.status)
      }
      if (mapping.extract.input) {
        const value = jsonPath(event, mapping.extract.input)
        if (value !== undefined) {
          update.input = value
        }
      }
      if (mapping.extract.output) {
        const value = jsonPath(event, mapping.extract.output)
        if (value !== undefined) {
          update.output = value
        }
      }
    }

    return update
  }

  /**
   * Checks if a JSON line represents the final result.
   *
   * @param line - JSON string from CLI stdout
   * @returns Result extraction or indication that it's not a result
   */
  const parseResult = (line: string): ResultParseResult => {
    let event: unknown
    try {
      event = JSON.parse(line)
    } catch {
      return { isResult: false }
    }

    const matchValue = jsonPath(event, result.matchPath)
    // Support wildcard "*" to match any non-null value
    const matches =
      result.matchValue === '*' ? matchValue !== undefined && matchValue !== null : matchValue === result.matchValue

    if (matches) {
      const content = jsonPathString(event, result.contentPath)
      return {
        isResult: true,
        content: content ?? '',
        raw: event,
      }
    }

    return { isResult: false }
  }

  return {
    parseLine,
    parseResult,
  }
}

/** Output parser type */
export type OutputParser = ReturnType<typeof createOutputParser>
