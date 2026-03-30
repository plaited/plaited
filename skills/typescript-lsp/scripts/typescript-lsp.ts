/**
 * Unified TypeScript LSP tool.
 *
 * @remarks
 * Combines the LSP JSON-RPC client and operation dispatch into a single module.
 * Accepts JSON positional arg or stdin pipe. `--schema input|output` for discovery.
 *
 * @public
 */

import { join } from 'node:path'
import type { Subprocess } from 'bun'
import { parseCli } from 'plaited'
import * as z from 'zod'

// ============================================================================
// JSON-RPC Types
// ============================================================================

/** @internal */
type JsonRpcRequest = {
  jsonrpc: '2.0'
  id: number
  method: string
  params?: unknown
}

/** @internal */
type JsonRpcResponse = {
  jsonrpc: '2.0'
  id: number
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

/** @internal */
type JsonRpcNotification = {
  jsonrpc: '2.0'
  method: string
  params?: unknown
}

/** @internal */
type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer?: ReturnType<typeof setTimeout>
}

type LspExecutionContext = {
  workspace?: string
  signal?: AbortSignal
}

// ============================================================================
// LSP Client
// ============================================================================

/**
 * TypeScript Language Server client using Bun.spawn.
 *
 * @remarks
 * Spawns typescript-language-server as a subprocess and communicates
 * via LSP JSON-RPC protocol over stdio.
 *
 * @internal
 */
export class LspClient {
  #process: Subprocess | null = null
  #requestId = 0
  #pendingRequests = new Map<number, PendingRequest>()
  #buffer = new Uint8Array(0)
  #contentLength = -1
  #initialized = false
  #rootUri: string
  #serverCommand: string[]
  #requestTimeout: number

  constructor({
    rootUri,
    command = ['bun', 'typescript-language-server', '--stdio'],
    requestTimeout = 30000,
  }: {
    rootUri: string
    command?: string[]
    requestTimeout?: number
  }) {
    this.#rootUri = rootUri
    this.#serverCommand = command
    this.#requestTimeout = requestTimeout
  }

  async start(): Promise<void> {
    if (this.#process) {
      throw new Error('LSP server already running')
    }

    this.#process = Bun.spawn(this.#serverCommand, {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    })

    this.#readOutput()
    await this.#initialize()
  }

  async stop(): Promise<void> {
    if (!this.#process) return

    try {
      await this.request('shutdown', null)
      this.notify('exit')
    } catch {
      // Ignore errors during shutdown
    }

    this.#process.kill()
    this.#process = null
    this.#initialized = false
  }

  isRunning(): boolean {
    return this.#process !== null && this.#initialized
  }

  async request<T = unknown>(method: string, params: unknown): Promise<T> {
    if (!this.#process) {
      throw new Error('LSP server not running')
    }

    this.#requestId += 1
    const id = this.#requestId
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params: params ?? undefined,
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pendingRequests.delete(id)
        reject(new Error(`LSP request timeout: ${method} (id=${id})`))
      }, this.#requestTimeout)

      this.#pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      })
      this.#send(request)
    })
  }

  notify(method: string, params?: unknown): void {
    if (!this.#process) {
      throw new Error('LSP server not running')
    }

    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      params,
    }

    this.#send(notification)
  }

  // LSP Methods

  async hover(uri: string, line: number, character: number): Promise<unknown> {
    return this.request('textDocument/hover', {
      textDocument: { uri },
      position: { line, character },
    })
  }

  async definition(uri: string, line: number, character: number): Promise<unknown> {
    return this.request('textDocument/definition', {
      textDocument: { uri },
      position: { line, character },
    })
  }

  async references(uri: string, line: number, character: number, includeDeclaration = true): Promise<unknown> {
    return this.request('textDocument/references', {
      textDocument: { uri },
      position: { line, character },
      context: { includeDeclaration },
    })
  }

  async completion(uri: string, line: number, character: number): Promise<unknown> {
    return this.request('textDocument/completion', {
      textDocument: { uri },
      position: { line, character },
    })
  }

  async signatureHelp(uri: string, line: number, character: number): Promise<unknown> {
    return this.request('textDocument/signatureHelp', {
      textDocument: { uri },
      position: { line, character },
    })
  }

  async documentSymbols(uri: string): Promise<unknown> {
    return this.request('textDocument/documentSymbol', {
      textDocument: { uri },
    })
  }

  async workspaceSymbols(query: string): Promise<unknown> {
    return this.request('workspace/symbol', { query })
  }

  openDocument(uri: string, languageId: string, version: number, text: string): void {
    this.notify('textDocument/didOpen', {
      textDocument: { uri, languageId, version, text },
    })
  }

  closeDocument(uri: string): void {
    this.notify('textDocument/didClose', {
      textDocument: { uri },
    })
  }

  async #initialize(): Promise<void> {
    const result = await this.request('initialize', {
      processId: process.pid,
      rootUri: this.#rootUri,
      capabilities: {
        textDocument: {
          hover: { contentFormat: ['markdown', 'plaintext'] },
          definition: { linkSupport: true },
          references: {},
          completion: {
            completionItem: {
              snippetSupport: true,
              documentationFormat: ['markdown', 'plaintext'],
            },
          },
          signatureHelp: {
            signatureInformation: {
              documentationFormat: ['markdown', 'plaintext'],
            },
          },
          documentSymbol: {
            hierarchicalDocumentSymbolSupport: true,
          },
        },
        workspace: {
          symbol: { symbolKind: {} },
        },
      },
    })

    this.notify('initialized', {})
    this.#initialized = true

    return result as Promise<void>
  }

  #send(message: JsonRpcRequest | JsonRpcNotification): void {
    const stdin = this.#process?.stdin
    if (!stdin || typeof stdin === 'number') {
      throw new Error('LSP server stdin not available')
    }

    const content = JSON.stringify(message)
    const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`

    stdin.write(header + content)
  }

  async #readOutput(): Promise<void> {
    const stdout = this.#process?.stdout
    if (!stdout || typeof stdout === 'number') return

    const reader = stdout.getReader()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const newBuffer = new Uint8Array(this.#buffer.length + value.length)
        newBuffer.set(this.#buffer)
        newBuffer.set(value, this.#buffer.length)
        this.#buffer = newBuffer

        this.#processBuffer()
      }
    } catch {
      // Stream closed
    }
  }

  #processBuffer(): void {
    const decoder = new TextDecoder()

    while (true) {
      if (this.#contentLength === -1) {
        const headerEndIndex = this.#findHeaderEnd()
        if (headerEndIndex === -1) break

        const headerBytes = this.#buffer.slice(0, headerEndIndex)
        const header = decoder.decode(headerBytes)
        const match = header.match(/Content-Length: (\d+)/)
        if (!match?.[1]) {
          this.#buffer = this.#buffer.slice(headerEndIndex + 4)
          continue
        }

        this.#contentLength = parseInt(match[1], 10)
        this.#buffer = this.#buffer.slice(headerEndIndex + 4)
      }

      if (this.#buffer.length < this.#contentLength) break

      const contentBytes = this.#buffer.slice(0, this.#contentLength)
      const content = decoder.decode(contentBytes)
      this.#buffer = this.#buffer.slice(this.#contentLength)
      this.#contentLength = -1

      try {
        const message = JSON.parse(content) as JsonRpcResponse
        this.#handleMessage(message)
      } catch {
        // Skip invalid JSON
      }
    }
  }

  #findHeaderEnd(): number {
    const CRLF = [13, 10, 13, 10] // \r\n\r\n
    for (let i = 0; i <= this.#buffer.length - 4; i++) {
      if (
        this.#buffer[i] === CRLF[0] &&
        this.#buffer[i + 1] === CRLF[1] &&
        this.#buffer[i + 2] === CRLF[2] &&
        this.#buffer[i + 3] === CRLF[3]
      ) {
        return i
      }
    }
    return -1
  }

  #handleMessage(message: JsonRpcResponse): void {
    if ('id' in message && message.id !== undefined) {
      const pending = this.#pendingRequests.get(message.id)
      if (pending) {
        if (pending.timer) {
          clearTimeout(pending.timer)
        }
        this.#pendingRequests.delete(message.id)
        if (message.error) {
          pending.reject(new Error(`LSP Error: ${message.error.message}`))
        } else {
          pending.resolve(message.result)
        }
      }
    }
    // Notifications and server requests are ignored
  }
}

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
  type: z
    .enum(['hover', 'references', 'definition', 'symbols', 'exports', 'find', 'scan'])
    .describe('LSP operation type'),
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
const resolveFilePath = (filePath: string, base?: string): string => {
  if (filePath.startsWith('/')) return filePath
  return join(base ?? process.cwd(), filePath)
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
 * @internal
 */
/**
 * Map file extension to Bun.Transpiler loader for scan().
 *
 * @internal
 */
const getLoader = (path: string): 'tsx' | 'ts' | 'jsx' | 'js' => {
  if (path.endsWith('.tsx')) return 'tsx'
  if (path.endsWith('.ts')) return 'ts'
  if (path.endsWith('.jsx')) return 'jsx'
  return 'js'
}

const executeOperation = async (
  client: LspClient | null,
  uri: string,
  text: string,
  op: LspOperation,
  absolutePath: string,
): Promise<unknown> => {
  switch (op.type) {
    case 'scan': {
      const transpiler = new Bun.Transpiler({ loader: getLoader(absolutePath) })
      const result = transpiler.scan(text)
      return { imports: result.imports, exports: result.exports }
    }
    case 'hover': {
      if (op.line === undefined || op.character === undefined) {
        throw new Error('hover requires line and character')
      }
      return client!.hover(uri, op.line, op.character)
    }
    case 'references': {
      if (op.line === undefined || op.character === undefined) {
        throw new Error('references requires line and character')
      }
      return client!.references(uri, op.line, op.character)
    }
    case 'definition': {
      if (op.line === undefined || op.character === undefined) {
        throw new Error('definition requires line and character')
      }
      return client!.definition(uri, op.line, op.character)
    }
    case 'symbols': {
      const symbols = (await client!.documentSymbols(uri)) as SymbolInfo[]
      return flattenSymbols(symbols)
    }
    case 'exports': {
      const symbols = (await client!.documentSymbols(uri)) as SymbolInfo[]
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
      return client!.workspaceSymbols(op.query)
    }
  }
}

export { getLoader }

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
 * When `ctx` is provided, `workspace` sets the LSP rootUri and `signal`
 * enables abort-based subprocess cancellation via BP interrupt.
 *
 * @param input - File path and operations to perform
 * @param ctx - Optional execution context for workspace root and abort signal
 * @returns File path and results array matching operations order
 *
 * @public
 */
const executeLsp = async (input: LspInput, ctx?: LspExecutionContext): Promise<LspOutput> => {
  if (ctx?.signal?.aborted) throw new Error('Aborted')

  const absolutePath = resolveFilePath(input.file, ctx?.workspace)
  const uri = `file://${absolutePath}`

  const file = Bun.file(absolutePath)
  if (!(await file.exists())) {
    throw new Error(`File not found: ${absolutePath}`)
  }

  const text = await file.text()

  // If all operations are scan-only, skip LSP server entirely
  const needsLsp = input.operations.some((op) => op.type !== 'scan')

  let client: LspClient | null = null
  if (needsLsp) {
    const rootUri = ctx ? `file://${ctx.workspace}` : `file://${process.cwd()}`
    client = new LspClient({ rootUri })
  }

  const onAbort = () => {
    client?.stop().catch(() => {})
  }
  ctx?.signal?.addEventListener('abort', onAbort, { once: true })

  try {
    if (client) {
      await client.start()
      client.openDocument(uri, getLanguageId(absolutePath), 1, text)
    }

    const results: LspResult[] = []

    for (const op of input.operations) {
      try {
        const data = await executeOperation(client, uri, text, op, absolutePath)
        results.push({ type: op.type, data })
      } catch (error) {
        results.push({ type: op.type, error: error instanceof Error ? error.message : String(error) })
      }
    }

    if (client) {
      client.closeDocument(uri)
      await client.stop()
    }

    return { file: input.file, results }
  } catch (error) {
    await client?.stop().catch(() => {})
    throw error
  } finally {
    ctx?.signal?.removeEventListener('abort', onAbort)
  }
}

export { executeLsp }

/**
 * CLI entry point for the TypeScript LSP skill.
 *
 * @remarks
 * Uses shared `parseCli` for input parsing and schema discovery.
 * Custom execution handles partial failure exit codes:
 * exit 0 = all operations succeeded, 1 = some operations failed,
 * 2 = bad input or tool error.
 *
 * @public
 */
export const typescriptLspCli = async (args: string[]) => {
  if (args.includes('--help') || args.includes('-h')) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log(`plaited typescript-lsp
Unified TypeScript LSP tool — type-aware codebase analysis

Usage: plaited typescript-lsp '<json>' [options]
       echo '<json>' | plaited typescript-lsp

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
  scan         { type: "scan" }                          Fast import/export extraction (no LSP)

Options:
  --schema <input|output>  Print JSON Schema and exit
  -h, --help               Show this help

Exit codes:
  0  Success (or --schema/--help)
  1  One or more operations failed
  2  Bad input or tool error`)
    return
  }

  const input = await parseCli(args, LspInputSchema, { name: 'typescript-lsp', outputSchema: LspOutputSchema })

  try {
    const result = await executeLsp(input)
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log(JSON.stringify(result, null, 2))
    if (result.results.some((r) => r.error)) process.exit(1)
  } catch (error) {
    console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
    process.exit(2)
  }
}

if (import.meta.main) {
  await typescriptLspCli(Bun.argv.slice(2))
}
