#!/usr/bin/env bun
/**
 * Unified TypeScript LSP tool.
 *
 * @remarks
 * Accepts JSON positional arg or stdin pipe.
 * `--schema input|output` for agent discovery.
 *
 * @see LspClient for the JSON-RPC protocol handling
 *
 * @public
 */

import { join } from 'node:path'
import { z } from 'zod'
import { LspClient } from './lsp-client.ts'

// ============================================================================
// Types
// ============================================================================

/**
 * Symbol info returned by the LSP textDocument/documentSymbol response.
 *
 * @internal
 */
type SymbolInfo = {
  name: string
  kind: number
  range: { start: { line: number; character: number }; end: { line: number; character: number } }
  children?: SymbolInfo[]
}

/**
 * A single LSP operation to perform.
 *
 * @public
 */
type LspOperation = z.infer<typeof LspOperationSchema>

/**
 * Input for the unified LSP tool.
 *
 * @public
 */
type LspInput = z.infer<typeof LspInputSchema>

/**
 * Result of a single LSP operation.
 *
 * @public
 */
type LspResult = {
  type: string
  data?: unknown
  error?: string
}

/**
 * Output of the unified LSP tool.
 *
 * @public
 */
type LspOutput = {
  file: string
  results: LspResult[]
}

export type { LspOperation, LspInput, LspResult, LspOutput }

// ============================================================================
// Schemas
// ============================================================================

/** @public */
const LspOperationSchema = z.object({
  type: z.enum(['hover', 'references', 'definition', 'symbols', 'exports', 'find']).describe('LSP operation type'),
  line: z.number().optional().describe('Line number (0-indexed) — required for hover, references, definition'),
  character: z
    .number()
    .optional()
    .describe('Character position (0-indexed) — required for hover, references, definition'),
  query: z.string().optional().describe('Symbol name or partial name — required for find'),
})

/** @public */
const LspInputSchema = z.object({
  file: z.string().describe('Path to TypeScript/JavaScript file (also serves as context for workspace operations)'),
  operations: z
    .array(LspOperationSchema)
    .describe('Operations to perform in a single LSP session (one server start, multiple queries)'),
})

/** @public */
const LspOutputSchema = z.object({
  file: z.string().describe('Path to the analyzed file'),
  results: z
    .array(
      z.object({
        type: z.string().describe('Operation type that was performed'),
        error: z.string().optional().describe('Error message if the operation failed'),
      }),
    )
    .describe('Results array matching input operations order — each result includes operation-specific data fields'),
})

export { LspOperationSchema, LspInputSchema, LspOutputSchema }

// ============================================================================
// Constants
// ============================================================================

/** @internal */
const SYMBOL_KIND_NAMES: Record<number, string> = {
  1: 'File',
  2: 'Module',
  3: 'Namespace',
  4: 'Package',
  5: 'Class',
  6: 'Method',
  7: 'Property',
  8: 'Field',
  9: 'Constructor',
  10: 'Enum',
  11: 'Interface',
  12: 'Function',
  13: 'Variable',
  14: 'Constant',
  15: 'String',
  16: 'Number',
  17: 'Boolean',
  18: 'Array',
  19: 'Object',
  20: 'Key',
  21: 'Null',
  22: 'EnumMember',
  23: 'Struct',
  24: 'Event',
  25: 'Operator',
  26: 'TypeParameter',
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Resolve a file path to an absolute path.
 *
 * @param filePath - Absolute or relative file path
 * @returns Absolute file path
 *
 * @internal
 */
const resolveFilePath = (filePath: string): string => {
  if (filePath.startsWith('/')) return filePath
  return join(process.cwd(), filePath)
}

/**
 * Determine the LSP language ID from a file path extension.
 *
 * @param path - File path with extension
 * @returns LSP language identifier
 *
 * @internal
 */
const getLanguageId = (path: string): string => {
  if (path.endsWith('.tsx')) return 'typescriptreact'
  if (path.endsWith('.ts')) return 'typescript'
  if (path.endsWith('.jsx')) return 'javascriptreact'
  return 'javascript'
}

/**
 * Flatten hierarchical document symbols into a flat array with dotted names.
 *
 * @remarks
 * Converts nested LSP `DocumentSymbol` responses into a flat list where
 * child symbols are named `Parent.child`. Kind numbers are mapped to
 * human-readable strings.
 *
 * @param symbols - Hierarchical symbol array from documentSymbol response
 * @param prefix - Parent name prefix for nested symbols
 * @returns Flat array of `{ name, kind, line }` entries
 *
 * @internal
 */
const flattenSymbols = (symbols: SymbolInfo[], prefix = ''): Array<{ name: string; kind: string; line: number }> => {
  const result: Array<{ name: string; kind: string; line: number }> = []
  for (const sym of symbols) {
    result.push({
      name: prefix ? `${prefix}.${sym.name}` : sym.name,
      kind: SYMBOL_KIND_NAMES[sym.kind] || `Unknown(${sym.kind})`,
      line: sym.range.start.line,
    })
    if (sym.children) {
      result.push(...flattenSymbols(sym.children, sym.name))
    }
  }
  return result
}

export { resolveFilePath, getLanguageId, flattenSymbols }

// ============================================================================
// Operation Dispatch
// ============================================================================

/**
 * Execute a single LSP operation against an open document.
 *
 * @param client - Active LSP client with an open document
 * @param uri - Document URI
 * @param text - Document text content (for export detection)
 * @param op - Operation to perform
 * @returns Operation-specific result
 *
 * @internal
 */
const executeOperation = async (client: LspClient, uri: string, text: string, op: LspOperation): Promise<unknown> => {
  switch (op.type) {
    case 'hover': {
      if (op.line === undefined || op.character === undefined) {
        throw new Error('hover requires line and character')
      }
      return client.hover(uri, op.line, op.character)
    }
    case 'references': {
      if (op.line === undefined || op.character === undefined) {
        throw new Error('references requires line and character')
      }
      return client.references(uri, op.line, op.character)
    }
    case 'definition': {
      if (op.line === undefined || op.character === undefined) {
        throw new Error('definition requires line and character')
      }
      return client.definition(uri, op.line, op.character)
    }
    case 'symbols': {
      const symbols = (await client.documentSymbols(uri)) as SymbolInfo[]
      return flattenSymbols(symbols)
    }
    case 'exports': {
      const symbols = (await client.documentSymbols(uri)) as SymbolInfo[]
      const all = flattenSymbols(symbols)
      const lines = text.split('\n')
      return all.filter((sym) => {
        if (sym.name.includes('.')) return false
        const line = lines[sym.line]
        return line?.trimStart().startsWith('export')
      })
    }
    case 'find': {
      if (!op.query) {
        throw new Error('find requires query')
      }
      return client.workspaceSymbols(op.query)
    }
  }
}

// ============================================================================
// Library API
// ============================================================================

/**
 * Execute LSP operations against a TypeScript/JavaScript file.
 *
 * @remarks
 * Starts a `typescript-language-server` subprocess, opens the target file,
 * runs all operations in sequence, then stops the server. Each operation
 * is independent — if one fails, the others still run.
 *
 * @param input - File path and operations to perform
 * @returns File path and results array matching operations order
 *
 * @public
 */
const executeLsp = async (input: LspInput): Promise<LspOutput> => {
  const absolutePath = resolveFilePath(input.file)
  const uri = `file://${absolutePath}`
  const rootUri = `file://${process.cwd()}`

  const client = new LspClient({ rootUri })

  try {
    await client.start()

    const file = Bun.file(absolutePath)
    if (!(await file.exists())) {
      throw new Error(`File not found: ${absolutePath}`)
    }

    const text = await file.text()
    client.openDocument(uri, getLanguageId(absolutePath), 1, text)

    const results: LspResult[] = []

    for (const op of input.operations) {
      try {
        const data = await executeOperation(client, uri, text, op)
        results.push({ type: op.type, data })
      } catch (error) {
        results.push({ type: op.type, error: error instanceof Error ? error.message : String(error) })
      }
    }

    client.closeDocument(uri)
    await client.stop()

    return { file: input.file, results }
  } catch (error) {
    await client.stop().catch(() => {})
    throw error
  }
}

export { executeLsp }

// ============================================================================
// CLI Handler
// ============================================================================

/**
 * CLI entry point.
 *
 * @remarks
 * Exit 0 = success, 1 = operation errors, 2 = bad input.
 *
 * @param args - CLI arguments (after command name)
 *
 * @public
 */
export const lsp = async (args: string[]) => {
  if (args.includes('--help') || args.includes('-h')) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log(`plaited lsp
Unified TypeScript LSP tool — type-aware codebase analysis

Usage: plaited lsp '<json>' [options]
       echo '<json>' | plaited lsp

Input (JSON):
  file         string              Path to TypeScript/JavaScript file
  operations   LspOperation[]      Operations to perform in one session

Operations:
  hover        { type: "hover", line, character }        Type info at position
  references   { type: "references", line, character }   All references to symbol
  definition   { type: "definition", line, character }   Go to definition
  symbols      { type: "symbols" }                       All symbols in file
  exports      { type: "exports" }                       Exported symbols only
  find         { type: "find", query }                   Search workspace symbols

Options:
  --schema <input|output>  Print JSON Schema and exit
  -h, --help               Show this help

Exit codes:
  0  Success (or --schema/--help)
  1  One or more operations failed
  2  Bad input or tool error`)
    return
  }

  const schemaIdx = args.indexOf('--schema')
  if (schemaIdx !== -1) {
    const target = args[schemaIdx + 1]
    if (target === 'output') {
      // biome-ignore lint/suspicious/noConsole: CLI output
      console.log(JSON.stringify(z.toJSONSchema(LspOutputSchema)))
    } else {
      // biome-ignore lint/suspicious/noConsole: CLI output
      console.log(JSON.stringify(z.toJSONSchema(LspInputSchema)))
    }
    return
  }

  const positionals = args.filter((arg) => !arg.startsWith('--'))
  let rawInput: string | undefined

  if (positionals.length > 0) {
    rawInput = positionals[0]
  } else if (!process.stdin.isTTY) {
    const stdinData = await Bun.stdin.text()
    if (stdinData.trim()) rawInput = stdinData.trim()
  }

  let input: LspInput
  try {
    input = LspInputSchema.parse(rawInput ? JSON.parse(rawInput) : {})
  } catch (error) {
    if (error instanceof z.ZodError) {
      // biome-ignore lint/suspicious/noConsole: CLI output
      console.error(JSON.stringify(error.issues, null, 2))
    } else {
      // biome-ignore lint/suspicious/noConsole: CLI output
      console.error(`Invalid JSON input: ${error instanceof Error ? error.message : error}`)
    }
    process.exit(2)
  }

  try {
    const result = await executeLsp(input)
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log(JSON.stringify(result, null, 2))
    if (result.results.some((r) => r.error)) process.exit(1)
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
    process.exit(2)
  }
}

if (import.meta.main) {
  await lsp(Bun.argv.slice(2))
}
