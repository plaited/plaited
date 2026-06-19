/**
 * TypeScript LSP CLI — JSON-RPC passthrough over typescript-language-server.
 *
 * @remarks
 * Two modes via `mode` discriminant:
 *   - `execute`: spawn server, open file, send raw JSON-RPC requests, return results
 *   - `discover`: spawn server, initialize, return supported capabilities (method names)
 *
 * @public
 */

import { isAbsolute, normalize, relative, resolve } from 'node:path'
import type { Subprocess } from 'bun'
import * as z from 'zod'
import { makeCli } from './cli.ts'

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
// Capability → Method Mapping
// ============================================================================

/** @internal */
const CAPABILITY_TO_METHOD: Record<string, string> = {
  hoverProvider: 'textDocument/hover',
  referencesProvider: 'textDocument/references',
  definitionProvider: 'textDocument/definition',
  documentSymbolProvider: 'textDocument/documentSymbol',
  workspaceSymbolProvider: 'workspace/symbol',
  completionProvider: 'textDocument/completion',
  signatureHelpProvider: 'textDocument/signatureHelp',
  implementationProvider: 'textDocument/implementation',
  typeDefinitionProvider: 'textDocument/typeDefinition',
  renameProvider: 'textDocument/rename',
  codeActionProvider: 'textDocument/codeAction',
  documentFormattingProvider: 'textDocument/formatting',
  documentHighlightProvider: 'textDocument/documentHighlight',
  foldingRangeProvider: 'textDocument/foldingRange',
  inlayHintProvider: 'textDocument/inlayHint',
  semanticTokensProvider: 'textDocument/semanticTokens',
  selectionRangeProvider: 'textDocument/selectionRange',
}

// ============================================================================
// LSP Client
// ============================================================================

/**
 * TypeScript Language Server client using Bun.spawn.
 *
 * @remarks
 * Spawns typescript-language-server as a subprocess and communicates
 * via LSP JSON-RPC over stdio. Manages lifecycle: spawn → initialize →
 * open → request/notify → close → shutdown.
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
  #capabilities: Record<string, unknown> | null = null

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

  /**
   * Server capabilities returned by the `initialize` handshake.
   */
  get capabilities(): Record<string, unknown> | null {
    return this.#capabilities
  }

  async start(): Promise<void> {
    if (this.#process) throw new Error('LSP server already running')

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
      // Ignore shutdown errors
    }
    this.#process.kill()
    this.#process = null
    this.#initialized = false
  }

  isRunning(): boolean {
    return this.#process !== null && this.#initialized
  }

  async request<T = unknown>(method: string, params: unknown): Promise<T> {
    if (!this.#process) throw new Error('LSP server not running')

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
      this.#pendingRequests.set(id, { resolve: resolve as (value: unknown) => void, reject, timer })
      this.#send(request)
    })
  }

  notify(method: string, params?: unknown): void {
    if (!this.#process) throw new Error('LSP server not running')
    this.#send({ jsonrpc: '2.0', method, params })
  }

  async #initialize(): Promise<void> {
    const result = (await this.request('initialize', {
      processId: process.pid,
      rootUri: this.#rootUri,
      capabilities: {
        textDocument: {
          hover: { contentFormat: ['markdown', 'plaintext'] },
          definition: { linkSupport: true },
          references: {},
          completion: { completionItem: { snippetSupport: true, documentationFormat: ['markdown', 'plaintext'] } },
          signatureHelp: { signatureInformation: { documentationFormat: ['markdown', 'plaintext'] } },
          documentSymbol: { hierarchicalDocumentSymbolSupport: true },
        },
        workspace: { symbol: { symbolKind: {} } },
      },
    })) as Record<string, unknown> | undefined

    this.notify('initialized', {})
    this.#initialized = true
    this.#capabilities = (result?.capabilities as Record<string, unknown>) ?? null
  }

  #send(message: JsonRpcRequest | JsonRpcNotification): void {
    const stdin = this.#process?.stdin
    if (!stdin || typeof stdin === 'number') throw new Error('LSP server stdin not available')
    const content = JSON.stringify(message)
    stdin.write(`Content-Length: ${Buffer.byteLength(content)}\r\n\r\n${content}`)
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
        const match = decoder.decode(headerBytes).match(/Content-Length: (\d+)/)
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
        this.#handleMessage(JSON.parse(content) as JsonRpcResponse)
      } catch {
        // Skip invalid JSON
      }
    }
  }

  #findHeaderEnd(): number {
    for (let i = 0; i <= this.#buffer.length - 4; i++) {
      if (
        this.#buffer[i] === 13 &&
        this.#buffer[i + 1] === 10 &&
        this.#buffer[i + 2] === 13 &&
        this.#buffer[i + 3] === 10
      ) {
        return i
      }
    }
    return -1
  }

  #handleMessage(message: JsonRpcResponse): void {
    if (message.id !== undefined) {
      const pending = this.#pendingRequests.get(message.id)
      if (pending) {
        clearTimeout(pending.timer)
        this.#pendingRequests.delete(message.id)
        if (message.error) {
          pending.reject(new Error(`LSP Error: ${message.error.message}`))
        } else {
          pending.resolve(message.result)
        }
      }
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

/** @internal */
const resolveFilePath = (filePath: string, base?: string): string => {
  if (isAbsolute(filePath)) return normalize(filePath)
  return normalize(resolve(base ?? process.cwd(), filePath))
}

/** @internal */
const toPosixPath = (path: string): string => path.replace(/\\/g, '/')

/** @internal */
const makeDisplayPath = (absolutePath: string, base: string) => {
  const relativePath = toPosixPath(relative(base, absolutePath))
  if (relativePath === '' || relativePath === '.') return '.'
  return relativePath.startsWith('..') ? absolutePath : relativePath
}

/** @internal */
const resolveUriPath = (uri: string): string | undefined => {
  if (!uri.startsWith('file://')) return
  try {
    return normalize(decodeURIComponent(new URL(uri).pathname))
  } catch {
    return
  }
}

/** @internal */
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

/**
 * Recursively normalize LSP responses by converting `uri` and `targetUri`
 * fields to relative paths for agent consumption.
 *
 * @internal
 */
const normalizeUriBearingResult = (value: unknown, rootDir: string): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeUriBearingResult(entry, rootDir))
  }
  if (!isRecord(value)) {
    return value
  }

  const normalized: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    normalized[key] = normalizeUriBearingResult(entry, rootDir)
  }

  if (typeof value.uri === 'string') {
    const absolutePath = resolveUriPath(value.uri)
    if (absolutePath) {
      normalized.path = makeDisplayPath(absolutePath, rootDir)
    }
  }
  if (typeof value.targetUri === 'string') {
    const absolutePath = resolveUriPath(value.targetUri)
    if (absolutePath) {
      normalized.targetPath = makeDisplayPath(absolutePath, rootDir)
    }
  }
  return normalized
}

/** @internal */
const getLanguageId = (path: string): string => {
  if (path.endsWith('.tsx')) return 'typescriptreact'
  if (path.endsWith('.ts')) return 'typescript'
  if (path.endsWith('.jsx')) return 'javascriptreact'
  return 'javascript'
}

// ============================================================================
// Schemas
// ============================================================================

/** @public */
const ExecuteModeSchema = z
  .object({
    mode: z.literal('execute').describe('Execute JSON-RPC requests in an LSP session'),
    file: z.string().min(1).describe('Path to a TypeScript/JavaScript file'),
    rootDir: z.string().default('.').describe('Workspace root for file:// URI resolution'),
    requests: z
      .array(
        z.object({
          method: z.string().describe('LSP method name, e.g. textDocument/hover'),
          params: z.unknown().optional().describe('LSP method params'),
        }),
      )
      .min(1)
      .describe('JSON-RPC requests to execute in a single session'),
  })
  .describe('Execute raw LSP requests against a file in a single server session')

/** @public */
const DiscoverModeSchema = z
  .object({
    mode: z.literal('discover').describe('Discover available LSP methods supported by the server'),
    rootDir: z.string().default('.').describe('Workspace root for file:// URI resolution'),
  })
  .describe('Discover LSP server capabilities via initialize handshake')

/** @public */
const LspInputSchema = z
  .discriminatedUnion('mode', [ExecuteModeSchema, DiscoverModeSchema])
  .describe('TypeScript LSP command input')

/** @public */
const ExecuteOutputSchema = z.object({
  mode: z.literal('execute'),
  file: z.string().describe('Relative path to the analyzed file'),
  results: z
    .array(
      z.object({
        method: z.string().describe('LSP method that was called'),
        result: z.unknown().optional().describe('Successful response payload'),
        error: z.string().optional().describe('Error message if the request failed'),
      }),
    )
    .describe('Results array matching input requests order'),
})

/** @public */
const DiscoverOutputSchema = z.object({
  mode: z.literal('discover'),
  capabilities: z
    .array(
      z.object({
        method: z.string().describe('LSP method name'),
        capability: z.string().describe('LSP capability flag name (from initialize response)'),
      }),
    )
    .describe('Supported LSP methods from server capabilities'),
})

/** @public */
const LspOutputSchema = z
  .discriminatedUnion('mode', [ExecuteOutputSchema, DiscoverOutputSchema])
  .describe('TypeScript LSP command output')

export type {
  /** @public */
  LspInput,
  /** @public */
  LspOutput,
}
export { LspInputSchema, LspOutputSchema }

// ============================================================================
// LspInput / LspOutput types
// ============================================================================

/** @public */
type LspInput = z.infer<typeof LspInputSchema>

/** @public */
type LspOutput = z.infer<typeof LspOutputSchema>

// ============================================================================
// executeLsp — run requests against a file
// ============================================================================

/**
 * Execute raw JSON-RPC requests against a TypeScript/JavaScript file.
 *
 * @remarks
 * Starts a `typescript-language-server` subprocess, opens the target file,
 * sends each request in sequence, then stops the server. Each request is
 * independent — if one fails, the others still run.
 *
 * When `ctx` is provided, `workspace` sets the LSP rootUri and `signal`
 * enables abort-based subprocess cancellation via BP interrupt.
 *
 * @param input - Execute mode input with file and requests
 * @param ctx - Optional execution context for workspace root and abort signal
 * @returns File path and results array matching requests order
 *
 * @public
 */
const executeLsp = async (input: LspInput, ctx?: LspExecutionContext): Promise<LspOutput> => {
  if (input.mode !== 'execute') {
    throw new Error('executeLsp requires mode: execute')
  }
  if (ctx?.signal?.aborted) throw new Error('Aborted')

  const workspaceBase = ctx?.workspace ?? process.cwd()
  const rootDir = resolve(workspaceBase, input.rootDir)
  const absolutePath = resolveFilePath(input.file, rootDir)

  const file = Bun.file(absolutePath)
  if (!(await file.exists())) {
    throw new Error(`File not found: ${absolutePath}`)
  }
  const text = await file.text()
  const uri = `file://${absolutePath}`

  const rootUri = `file://${rootDir}`
  const client = new LspClient({ rootUri })

  const onAbort = () => {
    client.stop().catch(() => {})
  }
  ctx?.signal?.addEventListener('abort', onAbort, { once: true })

  try {
    await client.start()
    const languageId = getLanguageId(input.file)
    client.notify('textDocument/didOpen', {
      textDocument: { uri, languageId, version: 1, text },
    })

    const results: Array<{ method: string; result?: unknown; error?: string }> = []

    for (const req of input.requests) {
      try {
        let data = await client.request(req.method, req.params)
        data = normalizeUriBearingResult(data, rootDir)
        results.push({ method: req.method, result: data })
      } catch (error) {
        results.push({ method: req.method, error: error instanceof Error ? error.message : String(error) })
      }
    }

    client.notify('textDocument/didClose', { textDocument: { uri } })
    await client.stop()

    return { mode: 'execute', file: makeDisplayPath(absolutePath, rootDir), results }
  } catch (error) {
    await client.stop().catch(() => {})
    throw error
  } finally {
    ctx?.signal?.removeEventListener('abort', onAbort)
  }
}

export { executeLsp }

// ============================================================================
// discover — list server capabilities
// ============================================================================

/**
 * Discover supported LSP methods by probing the server's initialize handshake.
 *
 * @remarks
 * Spawns typescript-language-server, performs the initialize handshake,
 * reads the server capabilities, maps capability flags to LSP method names,
 * then shuts down.
 *
 * @internal
 */
const handleDiscover = async (rootDir: string): Promise<LspOutput> => {
  const rootUri = `file://${resolve(rootDir)}`
  const client = new LspClient({ rootUri })

  try {
    await client.start()

    const caps = client.capabilities ?? {}
    const capabilities = Object.entries(CAPABILITY_TO_METHOD)
      .filter(([cap]) => Boolean(caps[cap]))
      .map(([capability, method]) => ({ method, capability }))

    await client.stop()

    return { mode: 'discover', capabilities }
  } catch (error) {
    await client.stop().catch(() => {})
    throw error
  }
}

// ============================================================================
// CLI Entry
// ============================================================================

/** @public */
export const lspCli = makeCli({
  name: 'typescript-lsp',
  inputSchema: LspInputSchema,
  outputSchema: LspOutputSchema,
  help: [
    'Raw JSON-RPC passthrough over typescript-language-server.',
    'Two modes via `mode` discriminant:',
    '',
    '  execute   Open a file and send raw JSON-RPC LSP requests',
    '  discover  Probe server capabilities and list supported methods',
    '',
    'Execute mode fields:',
    '  file      Path to TypeScript/JavaScript file',
    '  rootDir   Workspace root for URI resolution (default ".")',
    '  requests  Array of { method, params? } — raw LSP request objects',
    '',
    'Discover mode fields:',
    '  rootDir   Workspace root for URI resolution (default ".")',
    '',
    'Examples:',
    '  plaited typescript-lsp \'{"mode":"execute","file":"src/index.ts","requests":[{"method":"textDocument/hover","params":{"textDocument":{"uri":"file://src/index.ts"},"position":{"line":5,"character":10}}}]}\'',
    '  plaited typescript-lsp \'{"mode":"discover"}\'',
  ].join('\n'),
  run: async (input) => {
    if (input.mode === 'discover') {
      return handleDiscover(input.rootDir)
    }
    return executeLsp(input)
  },
})
