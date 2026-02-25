/**
 * Zod schemas for headless adapter configuration.
 *
 * @remarks
 * These schemas define how to interact with ANY headless CLI agent via a
 * schema-driven approach. No hardcoded agent-specific logic - the schema
 * defines everything: command, flags, output parsing rules.
 *
 * @packageDocumentation
 */

import { z } from 'zod'

// ============================================================================
// Output Event Mapping Schema
// ============================================================================

/**
 * Schema for matching CLI output to session update types.
 *
 * @remarks
 * Uses JSONPath-like patterns to match events in CLI JSON output
 * and map them to session update types.
 */
export const OutputEventMatchSchema = z.object({
  /** JSONPath to match event type in CLI output (e.g., "$.type") */
  path: z.string(),
  /** Value to match at the path (e.g., "tool_use") */
  value: z.string(),
})

/** Output event match type */
export type OutputEventMatch = z.infer<typeof OutputEventMatchSchema>

/**
 * Schema for extracting content from matched events.
 *
 * @remarks
 * Known fields (`content`, `title`, `status`, `input`, `output`) are used by the
 * output parser to populate `ParsedUpdate` properties. Additional string-valued
 * fields are preserved during validation for forward compatibility but are not
 * consumed by the parser.
 *
 * Paths can be:
 * - JSONPath expressions (e.g., "$.message.text")
 * - Literal strings in single quotes (e.g., "'pending'")
 */
export const OutputEventExtractSchema = z
  .object({
    /** JSONPath to extract main content */
    content: z.string().optional(),
    /** JSONPath to extract title (for tool calls) */
    title: z.string().optional(),
    /** JSONPath to extract status (or literal like "'pending'") */
    status: z.string().optional(),
    /** JSONPath to extract tool input arguments (e.g., "$.input") */
    input: z.string().optional(),
    /** JSONPath to extract tool output/result content (e.g., "$.content") */
    output: z.string().optional(),
  })
  .catchall(z.string())

/** Output event extract type */
export type OutputEventExtract = z.infer<typeof OutputEventExtractSchema>

/**
 * Schema for mapping CLI output events to session update types.
 *
 * @remarks
 * Each mapping specifies:
 * 1. How to match events (match.path + match.value)
 * 2. What session update type to emit (emitAs)
 * 3. What content to extract (extract)
 */
export const OutputEventMappingSchema = z.object({
  /** Matching criteria for CLI output */
  match: OutputEventMatchSchema,
  /** session update type to emit */
  emitAs: z.enum(['thought', 'tool_call', 'message', 'plan']),
  /** Content extraction configuration */
  extract: OutputEventExtractSchema.optional(),
})

/** Output event mapping type */
export type OutputEventMapping = z.infer<typeof OutputEventMappingSchema>

// ============================================================================
// Prompt Configuration Schema
// ============================================================================

/**
 * Schema for how to pass prompts to the CLI.
 *
 * @remarks
 * Three modes are supported:
 * 1. **Flag-based**: `flag: "-p"` - Pass prompt via command-line flag
 * 2. **Positional**: `flag: ""` - Pass prompt as positional argument
 * 3. **Stdin**: `stdin: true` - Write prompt to stdin (command should include `-` or equivalent)
 */
export const PromptConfigSchema = z
  .object({
    /** Flag to pass prompt (e.g., "-p", "--prompt"). Empty string for positional. */
    flag: z.string().optional(),
    /** Use stdin to pass prompt instead of command args */
    stdin: z.boolean().optional(),
    /** Format for stdin input in stream mode */
    stdinFormat: z.enum(['text', 'json']).optional(),
  })
  .refine((data) => !(data.flag && data.stdin), {
    message: "Cannot specify both 'flag' and 'stdin' modes - use either flag-based or stdin mode, not both",
  })

/** Prompt configuration type */
export type PromptConfig = z.infer<typeof PromptConfigSchema>

// ============================================================================
// Output Configuration Schema
// ============================================================================

/**
 * Schema for output format configuration.
 */
export const OutputConfigSchema = z.object({
  /** Flag for output format (e.g., "--output-format") */
  flag: z.string(),
  /** Value for output format (e.g., "stream-json") */
  value: z.string(),
})

/** Output configuration type */
export type OutputConfig = z.infer<typeof OutputConfigSchema>

// ============================================================================
// Resume Configuration Schema
// ============================================================================

/**
 * Schema for session resume support (stream mode).
 */
export const ResumeConfigSchema = z.object({
  /** Flag to resume session (e.g., "--resume") */
  flag: z.string(),
  /** JSONPath to extract session ID from output */
  sessionIdPath: z.string(),
})

/** Resume configuration type */
export type ResumeConfig = z.infer<typeof ResumeConfigSchema>

// ============================================================================
// Result Configuration Schema
// ============================================================================

/**
 * Schema for final result extraction.
 */
export const ResultConfigSchema = z.object({
  /** JSONPath to match result type (e.g., "$.type") */
  matchPath: z.string(),
  /** Value indicating final result (e.g., "result") */
  matchValue: z.string(),
  /** JSONPath to extract result content */
  contentPath: z.string(),
})

/** Result configuration type */
export type ResultConfig = z.infer<typeof ResultConfigSchema>

// ============================================================================
// Passthrough Type Mapping Schema
// ============================================================================

/**
 * Schema for passthrough type mapping.
 *
 * @remarks
 * Used when outputMode is 'passthrough' to map agent's native type names
 * to standard session update types. Useful for agents with well-structured
 * output that doesn't need complex JSONPath parsing.
 */
export const PassthroughTypeMapSchema = z.object({
  /** JSON field that contains the event type (default: "type") */
  typeField: z.string().default('type'),
  /** Mapping from agent type values to session update types */
  typeValues: z.record(z.string(), z.enum(['thought', 'tool_call', 'message', 'plan'])).optional(),
})

/** Passthrough type mapping type */
export type PassthroughTypeMap = z.infer<typeof PassthroughTypeMapSchema>

// ============================================================================
// Main Adapter Schema
// ============================================================================

/**
 * Schema for headless adapter configuration.
 *
 * @remarks
 * This schema defines everything needed to interact with a headless CLI agent:
 * - Command and flags to spawn
 * - How to pass prompts
 * - How to parse output (jsonpath or passthrough mode)
 * - Session handling mode
 *
 * Supports two output parsing modes:
 * - 'jsonpath': Use outputEvents for complex JSONPath-based parsing (default)
 * - 'passthrough': Direct type mapping for well-structured output
 *
 * Example (Claude):
 * ```json
 * {
 *   "version": 1,
 *   "name": "claude-headless",
 *   "command": ["claude"],
 *   "sessionMode": "stream",
 *   "timeout": 90000,
 *   "prompt": { "flag": "-p" },
 *   "output": { "flag": "--output-format", "value": "stream-json" },
 *   "outputEvents": [...]
 * }
 * ```
 */
export const HeadlessAdapterSchema = z.object({
  /** Schema version */
  version: z.literal(1),

  /** Human-readable adapter name */
  name: z.string(),

  /** Base command to spawn (e.g., ["claude"], ["gemini"]) */
  command: z.array(z.string()),

  /**
   * Session mode determines how multi-turn conversations work:
   * - 'stream': Keep process alive, multi-turn via stdin
   * - 'iterative': New process per turn, accumulate context in prompt
   */
  sessionMode: z.enum(['stream', 'iterative']),

  /** Default timeout for this agent in milliseconds (can be overridden per-prompt) */
  timeout: z.number().optional(),

  /** How to pass the prompt */
  prompt: PromptConfigSchema,

  /** Output format configuration */
  output: OutputConfigSchema,

  /** Flags for auto-approval in headless mode (e.g., ["--allowedTools", "*"]) */
  autoApprove: z.array(z.string()).optional(),

  /** Session resume support (stream mode only) */
  resume: ResumeConfigSchema.optional(),

  /** Working directory flag (if CLI needs explicit --cwd) */
  cwdFlag: z.string().optional(),

  /**
   * Output parsing mode:
   * - 'jsonpath': Use outputEvents for complex JSONPath-based parsing (default)
   * - 'passthrough': Direct type mapping for well-structured output
   */
  outputMode: z.enum(['jsonpath', 'passthrough']).default('jsonpath'),

  /** Output event mappings - how to parse CLI output into updates (jsonpath mode) */
  outputEvents: z.array(OutputEventMappingSchema).optional(),

  /** Type mapping for passthrough mode */
  passthroughTypeMap: PassthroughTypeMapSchema.optional(),

  /** Final result extraction configuration */
  result: ResultConfigSchema,

  /**
   * Template for formatting conversation history (iterative mode only).
   *
   * @remarks
   * Supports both string format (simple) and object format (advanced):
   * - String: "User: {{input}}\nAssistant: {{output}}"
   * - Object: { system: "...", turnFormat: "..." }
   */
  historyTemplate: z
    .union([
      z.string(),
      z.object({
        /** System prefix for accumulated history */
        system: z.string().optional(),
        /** Format for each turn: {{input}} and {{output}} placeholders */
        turnFormat: z.string(),
      }),
    ])
    .optional(),
})

/** Headless adapter configuration type */
export type HeadlessAdapterConfig = z.infer<typeof HeadlessAdapterSchema>

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates and parses a headless adapter configuration.
 *
 * @param config - Raw configuration object (e.g., from JSON file)
 * @returns Validated HeadlessAdapterConfig
 * @throws ZodError if validation fails
 */
export const parseHeadlessConfig = (config: unknown): HeadlessAdapterConfig => {
  return HeadlessAdapterSchema.parse(config)
}

/**
 * Safely validates a headless adapter configuration.
 *
 * @param config - Raw configuration object
 * @returns Result with success/failure and data or error
 */
export const safeParseHeadlessConfig = (config: unknown) => {
  return HeadlessAdapterSchema.safeParse(config)
}
