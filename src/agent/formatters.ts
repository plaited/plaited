/**
 * Model-specific formatters for tool and skill definitions.
 *
 * @remarks
 * Provides formatters that convert generic tool/skill definitions into
 * model-specific formats for function calling.
 *
 * **Supported Models:**
 * - FunctionGemma (Google's function-calling fine-tuned Gemma)
 *
 * @see {@link https://ai.google.dev/gemma/docs/functiongemma | FunctionGemma Documentation}
 *
 * @module
 */

import type { ToolSchema } from './agent.types.ts'
import type { SkillMetadata, SkillScript } from './skill-discovery.ts'

// ============================================================================
// FunctionGemma Tokens
// ============================================================================

/**
 * FunctionGemma control tokens for structured function calling.
 *
 * @see {@link https://ai.google.dev/gemma/docs/functiongemma/formatting-and-best-practices | FunctionGemma Formatting}
 */
export const FUNCTION_GEMMA_TOKENS = {
  /** Start of tool definition block */
  DECLARATION_START: '<start_function_declaration>',
  /** End of tool definition block */
  DECLARATION_END: '<end_function_declaration>',
  /** Start of function call block (model output) */
  CALL_START: '<start_function_call>',
  /** End of function call block (model output) */
  CALL_END: '<end_function_call>',
  /** Start of function response block (application output) */
  RESPONSE_START: '<start_function_response>',
  /** End of function response block (application output) */
  RESPONSE_END: '<end_function_response>',
  /** String delimiter to prevent special character misinterpretation */
  ESCAPE: '<escape>',
} as const

// ============================================================================
// Types
// ============================================================================

/**
 * Generic tool definition for formatting.
 *
 * @remarks
 * Model-agnostic representation of a callable tool.
 * Formatters convert this to model-specific formats.
 */
export type ToolDefinition = {
  /** Tool name (used for invocation) */
  name: string
  /** Description of what the tool does */
  description: string
  /** Optional parameters (if known) */
  parameters?: ToolParameter[]
}

/**
 * Tool parameter definition.
 */
export type ToolParameter = {
  /** Parameter name */
  name: string
  /** Parameter type */
  type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'OBJECT' | 'ARRAY'
  /** Whether the parameter is required */
  required?: boolean
  /** Parameter description */
  description?: string
}

/**
 * Parsed function call from model output.
 */
export type ParsedFunctionCall = {
  /** Function name that was called */
  name: string
  /** Arguments passed to the function */
  args: Record<string, unknown>
}

/**
 * Tool formatter function signature.
 */
export type ToolFormatter = (tools: ToolDefinition[]) => string

// ============================================================================
// FunctionGemma Formatter
// ============================================================================

/**
 * Escapes a string value for FunctionGemma format.
 *
 * @param value - String to escape
 * @returns Escaped string with delimiters
 *
 * @internal
 */
const escapeString = (value: string): string => `${FUNCTION_GEMMA_TOKENS.ESCAPE}${value}${FUNCTION_GEMMA_TOKENS.ESCAPE}`

/**
 * Formats tool definitions for FunctionGemma.
 *
 * @param tools - Array of tool definitions
 * @returns FunctionGemma-formatted tool declarations
 *
 * @remarks
 * Generates tool declarations using FunctionGemma's special token format:
 * ```
 * <start_function_declaration>declaration:tool_name{
 *   description:<escape>Tool description<escape>,
 *   parameters:{
 *     properties:{...},
 *     required:[...],
 *     type:<escape>OBJECT<escape>
 *   }
 * }<end_function_declaration>
 * ```
 *
 * @see {@link https://ai.google.dev/gemma/docs/functiongemma/formatting-and-best-practices | FunctionGemma Formatting}
 */
export const formatForFunctionGemma: ToolFormatter = (tools: ToolDefinition[]): string => {
  const declarations: string[] = []

  for (const tool of tools) {
    const properties: string[] = []
    const required: string[] = []

    if (tool.parameters) {
      for (const param of tool.parameters) {
        const paramProps: string[] = [`type:${escapeString(param.type)}`]

        if (param.description) {
          paramProps.push(`description:${escapeString(param.description)}`)
        }

        properties.push(`${param.name}:{${paramProps.join(',')}}`)

        if (param.required) {
          required.push(escapeString(param.name))
        }
      }
    }

    const parametersBlock =
      properties.length > 0
        ? `parameters:{properties:{${properties.join(',')}},required:[${required.join(',')}],type:${escapeString('OBJECT')}}`
        : `parameters:{properties:{},required:[],type:${escapeString('OBJECT')}}`

    const declaration = [
      FUNCTION_GEMMA_TOKENS.DECLARATION_START,
      `declaration:${tool.name}{`,
      `description:${escapeString(tool.description)},`,
      parametersBlock,
      '}',
      FUNCTION_GEMMA_TOKENS.DECLARATION_END,
    ].join('')

    declarations.push(declaration)
  }

  return declarations.join('\n')
}

/**
 * Parses a FunctionGemma function call from model output.
 *
 * @param output - Raw model output containing function call
 * @returns Parsed function call, or undefined if not found
 *
 * @remarks
 * Extracts function name and arguments from FunctionGemma's call format:
 * ```
 * <start_function_call>call:function_name{arg1:<escape>value<escape>}<end_function_call>
 * ```
 */
export const parseFunctionGemmaCall = (output: string): ParsedFunctionCall | undefined => {
  const callMatch = output.match(/<start_function_call>call:(\w+)\{([\s\S]*?)\}<end_function_call>/)

  if (!callMatch) return undefined

  const name = callMatch[1]!
  const argsString = callMatch[2]!

  // Parse arguments from FunctionGemma format
  const args: Record<string, unknown> = {}
  const argRegex = /(\w+):(?:<escape>([\s\S]*?)<escape>|(\d+(?:\.\d+)?|true|false))/g

  for (const match of argsString.matchAll(argRegex)) {
    const key = match[1]!
    const stringValue = match[2]
    const literalValue = match[3]

    if (stringValue !== undefined) {
      args[key] = stringValue
    } else if (literalValue !== undefined) {
      // Parse literal values
      if (literalValue === 'true') args[key] = true
      else if (literalValue === 'false') args[key] = false
      else if (literalValue.includes('.')) args[key] = parseFloat(literalValue)
      else args[key] = parseInt(literalValue, 10)
    }
  }

  return { name, args }
}

/**
 * Formats a function response for FunctionGemma.
 *
 * @param name - Function name that was called
 * @param result - Result to return to the model
 * @returns FunctionGemma-formatted response
 *
 * @remarks
 * Generates response in FunctionGemma's format:
 * ```
 * <start_function_response>response:function_name{key:<escape>value<escape>}<end_function_response>
 * ```
 */
export const formatFunctionGemmaResponse = (name: string, result: Record<string, unknown>): string => {
  const entries: string[] = []

  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'string') {
      entries.push(`${key}:${escapeString(value)}`)
    } else if (typeof value === 'boolean' || typeof value === 'number') {
      entries.push(`${key}:${value}`)
    } else {
      // Convert complex values to escaped JSON string
      entries.push(`${key}:${escapeString(JSON.stringify(value))}`)
    }
  }

  return [
    FUNCTION_GEMMA_TOKENS.RESPONSE_START,
    `response:${name}{${entries.join(',')}}`,
    FUNCTION_GEMMA_TOKENS.RESPONSE_END,
  ].join('')
}

// ============================================================================
// Conversion Helpers
// ============================================================================

/**
 * Converts a SkillScript to a ToolDefinition.
 *
 * @param script - Skill script metadata
 * @returns Tool definition for formatting
 */
export const scriptToToolDefinition = (script: SkillScript): ToolDefinition => ({
  name: script.qualifiedName,
  description: script.description,
  parameters: script.parameters.map((p) => ({
    name: p.name,
    type: p.type.toUpperCase() as ToolParameter['type'],
    required: p.required,
    description: p.description,
  })),
})

/**
 * Converts a SkillMetadata to a ToolDefinition (for skill invocation).
 *
 * @param skill - Skill metadata
 * @returns Tool definition for formatting
 *
 * @remarks
 * Skills themselves can be "tools" that load their full context.
 * This creates a tool that takes no parameters - invoking it
 * loads the skill's SKILL.md content.
 */
export const skillToToolDefinition = (skill: SkillMetadata): ToolDefinition => ({
  name: `load_skill:${skill.name}`,
  description: `Load the ${skill.name} skill: ${skill.description}`,
  parameters: [],
})

/**
 * Converts a ToolSchema (OpenAI format) to a ToolDefinition.
 *
 * @param schema - OpenAI-style tool schema
 * @returns Tool definition for formatting
 */
export const toolSchemaToDefinition = (schema: ToolSchema): ToolDefinition => {
  const parameters: ToolParameter[] = []

  for (const [name, prop] of Object.entries(schema.parameters.properties)) {
    const propObj = prop as { type?: string; description?: string }
    parameters.push({
      name,
      type: (propObj.type?.toUpperCase() || 'STRING') as ToolParameter['type'],
      required: schema.parameters.required?.includes(name),
      description: propObj.description,
    })
  }

  return {
    name: schema.name,
    description: schema.description,
    parameters,
  }
}

// ============================================================================
// Relation Context Formatting
// ============================================================================

/**
 * Formats relation nodes for FunctionGemma context.
 *
 * @param nodes - Array of relation nodes to format
 * @param options - Formatting options
 * @returns Formatted string for LLM context
 *
 * @remarks
 * Generates a tree-style representation of relation nodes with status indicators.
 * Useful for providing plan/step context to the model.
 *
 * Output format:
 * ```
 * plan: Implement authentication [in_progress]
 *   step: Create user model [done]
 *   step: Add login endpoint [pending] (depends on: step-1)
 * ```
 */
export const formatRelationsForContext = (
  nodes: Array<{
    id: string
    parents: string[]
    edgeType: string
    context: { description: string; status?: string; [key: string]: unknown }
  }>,
  options: {
    /** Include parent references (default: true) */
    showParents?: boolean
    /** Include status indicators (default: true) */
    showStatus?: boolean
    /** Indent string (default: '  ') */
    indent?: string
    /** Maximum depth to traverse (default: unlimited) */
    maxDepth?: number
  } = {},
): string => {
  const { showParents = true, showStatus = true, indent = '  ', maxDepth } = options

  // Build a map for quick lookup
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  // Find roots (nodes with no parents or parents not in the provided set)
  const roots = nodes.filter((n) => n.parents.length === 0 || n.parents.every((p) => !nodeMap.has(p)))

  // Track visited to avoid infinite loops in case of bad data
  const visited = new Set<string>()

  const lines: string[] = []

  const formatNode = (node: (typeof nodes)[0], depth: number): void => {
    if (visited.has(node.id)) return
    if (maxDepth !== undefined && depth > maxDepth) return

    visited.add(node.id)

    const prefix = indent.repeat(depth)
    const status = showStatus && node.context.status ? ` [${node.context.status}]` : ''

    // Show parents that are in the node set
    const parentRefs =
      showParents && node.parents.length > 0
        ? ` (depends on: ${node.parents.filter((p) => nodeMap.has(p)).join(', ')})`
        : ''

    lines.push(`${prefix}${node.edgeType}: ${node.context.description}${status}${parentRefs}`)

    // Find and format children
    const children = nodes.filter((n) => n.parents.includes(node.id))
    for (const child of children) {
      formatNode(child, depth + 1)
    }
  }

  // Format from roots
  for (const root of roots) {
    formatNode(root, 0)
  }

  return lines.join('\n')
}

/**
 * Formats a plan with its steps for FunctionGemma context.
 *
 * @param plan - Plan node
 * @param steps - Step nodes belonging to this plan
 * @returns Formatted string for LLM context
 *
 * @remarks
 * Convenience wrapper for formatRelationsForContext focused on plans.
 */
export const formatPlanContext = (
  plan: {
    id: string
    context: { description: string; status?: string }
  },
  steps: Array<{
    id: string
    parents: string[]
    context: { description: string; status?: string; [key: string]: unknown }
  }>,
): string => {
  const planNode = {
    id: plan.id,
    parents: [] as string[],
    edgeType: 'plan',
    context: plan.context,
  }

  const stepNodes = steps.map((s) => ({
    ...s,
    edgeType: 'step',
  }))

  return formatRelationsForContext([planNode, ...stepNodes])
}
