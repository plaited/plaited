/**
 * TypeScript LSP MCP tools — TypeScript 7 native API passthrough.
 *
 * Registers two tools: `typescript_lsp_execute` and `typescript_lsp_discover`.
 * `execute` opens a file and runs LSP method handlers; `discover` returns the
 * list of supported method-to-capability mappings.
 *
 * @public
 */

import { isAbsolute, normalize, relative, resolve } from 'node:path'
import type { SourceFile, Statement } from 'typescript/unstable/ast'
import { SyntaxKind } from 'typescript/unstable/ast'
import {
  isClassDeclaration,
  isEnumDeclaration,
  isFunctionDeclaration,
  isInterfaceDeclaration,
  isModuleDeclaration,
  isTypeAliasDeclaration,
  isVariableStatement,
} from 'typescript/unstable/ast/is'
import type { Project, Snapshot } from 'typescript/unstable/async'
import { API } from 'typescript/unstable/async'
import * as z from 'zod'
import { useMCPServer } from './use-mcp-server.ts'

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
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// ============================================================================
// Project Resolution Helpers
// ============================================================================

/**
 * Find the fully-initialized Project (with program/checker) that contains the
 * given file path. Falls back to the first project if no match.
 *
 * `getDefaultProjectForFile` returns a shallow proxy that lacks program/checker;
 * only the Project instances from `getProjects()` are fully wired.
 */
const findProjectForFile = (snapshot: Snapshot, filePath: string): Project | undefined => {
  const projects = snapshot.getProjects()
  for (const p of projects) {
    if (p.rootFiles?.includes(filePath)) return p
  }
  return projects[0]
}

// ============================================================================
// LSP Method → TS 7 API Handlers
// ============================================================================

type MethodHandler = (params: {
  snapshot: Snapshot
  rootDir: string
  requestParams: Record<string, unknown>
}) => Promise<unknown>

/** Map of LSP method names to TypeScript 7 API handlers. */
const METHOD_HANDLERS: Record<string, MethodHandler> = {
  'textDocument/documentSymbol': async ({ snapshot, requestParams }) => {
    const uri = (requestParams.textDocument as { uri?: string } | undefined)?.uri
    if (!uri) throw new Error('textDocument/documentSymbol requires textDocument.uri')
    const absolutePath = resolveUriPath(uri)
    if (!absolutePath) throw new Error(`Invalid URI: ${uri}`)

    const project = findProjectForFile(snapshot, absolutePath)
    if (!project) throw new Error(`No project found for file: ${absolutePath}`)

    const sourceFile = await project.program.getSourceFile(absolutePath)
    if (!sourceFile) throw new Error(`Source file not found: ${absolutePath}`)

    return extractDocumentSymbols(sourceFile)
  },

  'textDocument/hover': async ({ snapshot, requestParams }) => {
    const uri = (requestParams.textDocument as { uri?: string } | undefined)?.uri
    if (!uri) throw new Error('textDocument/hover requires textDocument.uri')
    const absolutePath = resolveUriPath(uri)
    if (!absolutePath) throw new Error(`Invalid URI: ${uri}`)

    const position = requestParams.position as { line?: number; character?: number } | undefined
    if (position?.line === undefined || position?.character === undefined) {
      throw new Error('textDocument/hover requires position.line and position.character')
    }

    const project = findProjectForFile(snapshot, absolutePath)
    if (!project) throw new Error(`No project found for file: ${absolutePath}`)

    const sourceFile = await project.program.getSourceFile(absolutePath)
    if (!sourceFile) throw new Error(`Source file not found: ${absolutePath}`)

    const offset = sourceFile.getPositionOfLineAndCharacter(position.line, position.character)
    const symbol = await project.checker.getSymbolAtPosition(absolutePath, offset)
    if (!symbol) return undefined

    const type = await project.checker.getTypeOfSymbol(symbol)
    const typeStr = type ? project.checker.typeToString(type) : undefined
    const docComment = await project.checker.getDocumentationCommentOfSymbol(symbol)
    const jsdoc = await project.checker.getJsDocTagsOfSymbol(symbol)

    return {
      name: symbol.name,
      kind: symbol.flags,
      type: typeStr,
      documentation: docComment,
      tags: jsdoc.map((t) => ({ name: t.name, text: t.text })),
    }
  },

  'textDocument/completion': async ({ snapshot, requestParams }) => {
    const uri = (requestParams.textDocument as { uri?: string } | undefined)?.uri
    if (!uri) throw new Error('textDocument/completion requires textDocument.uri')
    const absolutePath = resolveUriPath(uri)
    if (!absolutePath) throw new Error(`Invalid URI: ${uri}`)

    const position = requestParams.position as { line?: number; character?: number } | undefined
    if (position?.line === undefined || position?.character === undefined) {
      throw new Error('textDocument/completion requires position.line and position.character')
    }

    const project = findProjectForFile(snapshot, absolutePath)
    if (!project) throw new Error(`No project found for file: ${absolutePath}`)

    const sourceFile = await project.program.getSourceFile(absolutePath)
    if (!sourceFile) throw new Error(`Source file not found: ${absolutePath}`)

    const offset = sourceFile.getPositionOfLineAndCharacter(position.line, position.character)
    const info = await project.checker.getCompletionsAtPosition(absolutePath, offset)
    if (!info) return { isIncomplete: false, entries: [] }

    return {
      isIncomplete: info.isIncomplete,
      entries: info.entries.map((e) => ({
        name: e.name,
        kind: e.kind,
        sortText: e.sortText,
        insertText: e.insertText,
        detail: e.detail,
      })),
    }
  },

  'textDocument/definition': async ({ snapshot, requestParams }) => {
    const uri = (requestParams.textDocument as { uri?: string } | undefined)?.uri
    if (!uri) throw new Error('textDocument/definition requires textDocument.uri')
    const absolutePath = resolveUriPath(uri)
    if (!absolutePath) throw new Error(`Invalid URI: ${uri}`)

    const position = requestParams.position as { line?: number; character?: number } | undefined
    if (position?.line === undefined || position?.character === undefined) {
      throw new Error('textDocument/definition requires position.line and position.character')
    }

    const project = findProjectForFile(snapshot, absolutePath)
    if (!project) throw new Error(`No project found for file: ${absolutePath}`)

    const sourceFile = await project.program.getSourceFile(absolutePath)
    if (!sourceFile) throw new Error(`Source file not found: ${absolutePath}`)

    const offset = sourceFile.getPositionOfLineAndCharacter(position.line, position.character)
    const symbol = await project.checker.getSymbolAtPosition(absolutePath, offset)
    if (!symbol) return undefined

    const decl = symbol.valueDeclaration
    if (!decl) return undefined

    const resolvedNode = await decl.resolve(project)
    if (!resolvedNode) return undefined

    const declFile = resolvedNode.getSourceFile()
    const start = resolvedNode.getStart()
    const end = resolvedNode.getEnd()
    const lineChar = declFile.getLineAndCharacterOfPosition(start)
    const endLineChar = declFile.getLineAndCharacterOfPosition(end)

    return [
      {
        uri: `file://${declFile.fileName}`,
        range: {
          start: { line: lineChar.line, character: lineChar.character },
          end: { line: endLineChar.line, character: endLineChar.character },
        },
      },
    ]
  },
}

/** Map of TS 7 capability names to LSP method names. */
const CAPABILITY_TO_METHOD: Record<string, string> = {
  documentSymbolProvider: 'textDocument/documentSymbol',
  hoverProvider: 'textDocument/hover',
  completionProvider: 'textDocument/completion',
  definitionProvider: 'textDocument/definition',
}

// ============================================================================
// Document Symbol Extraction
// ============================================================================

/** @internal */
interface DocumentSymbolEntry {
  name: string
  kind: string
  range: [number, number]
}

const SYMBOL_KIND_NAMES: Record<number, string> = {
  [SyntaxKind.VariableStatement]: 'Variable',
  [SyntaxKind.FunctionDeclaration]: 'Function',
  [SyntaxKind.ClassDeclaration]: 'Class',
  [SyntaxKind.InterfaceDeclaration]: 'Interface',
  [SyntaxKind.TypeAliasDeclaration]: 'TypeAlias',
  [SyntaxKind.EnumDeclaration]: 'Enum',
  [SyntaxKind.ModuleDeclaration]: 'Module',
}

/** @internal */
const extractNameFromStatement = (stmt: Statement, sourceFile: SourceFile): string | undefined => {
  if (isVariableStatement(stmt)) {
    const decl = stmt.declarationList.declarations[0]
    if (!decl) return
    const name = decl.name
    if ('escapedText' in name) return (name as { escapedText: string }).escapedText
    return name.getText(sourceFile)
  }
  if (isFunctionDeclaration(stmt) || isClassDeclaration(stmt)) {
    return stmt.name?.text
  }
  if (isInterfaceDeclaration(stmt) || isTypeAliasDeclaration(stmt) || isEnumDeclaration(stmt)) {
    return stmt.name.text
  }
  if (isModuleDeclaration(stmt)) {
    return stmt.name?.text
  }
  return
}

/**
 * Extract top-level symbols from a source file for documentSymbol response.
 *
 * @internal
 */
const extractDocumentSymbols = (sourceFile: SourceFile): DocumentSymbolEntry[] => {
  const symbols: DocumentSymbolEntry[] = []

  for (const stmt of sourceFile.statements) {
    const name = extractNameFromStatement(stmt, sourceFile)
    if (!name) continue

    const kindNum = stmt.kind
    const kindName = SYMBOL_KIND_NAMES[kindNum] ?? `Unknown(${kindNum})`
    const start = stmt.getStart(sourceFile)
    const end = stmt.getEnd()

    symbols.push({
      name,
      kind: kindName,
      range: [start, end],
    })
  }

  return symbols
}

// ============================================================================
// Schemas
// ============================================================================

/** @public */
const ExecuteModeSchema = z
  .object({
    mode: z.literal('execute').describe('Execute LSP-style requests against a file'),
    file: z.string().min(1).describe('Path to a TypeScript/JavaScript file'),
    rootDir: z.string().default('.').describe('Workspace root for file:// URI resolution'),
    requests: z
      .array(
        z.object({
          method: z.string().describe('LSP method name, e.g. textDocument/documentSymbol'),
          params: z.unknown().optional().describe('LSP method params'),
        }),
      )
      .min(1)
      .describe('Requests to execute in a single session'),
  })
  .describe('Execute LSP-style requests against a file in a single server session')

/** @public */
const DiscoverModeSchema = z
  .object({
    mode: z.literal('discover').describe('Discover available LSP methods supported by the server'),
    rootDir: z.string().default('.').describe('Workspace root for file:// URI resolution'),
  })
  .describe('Discover TypeScript 7 API capabilities')

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
  message: z.string().optional().describe('info or error detail'),
  isError: z.boolean().optional().describe('true when the operation failed'),
})

/** @public */
const DiscoverOutputSchema = z.object({
  mode: z.literal('discover'),
  capabilities: z
    .array(
      z.object({
        method: z.string().describe('LSP method name'),
        capability: z.string().describe('LSP capability flag name (from TypeScript 7 API)'),
      }),
    )
    .describe('Supported LSP methods from TypeScript 7 API'),
})

/** @public */
const LspOutputSchema = z
  .discriminatedUnion('mode', [ExecuteOutputSchema, DiscoverOutputSchema])
  .describe('TypeScript LSP command output')

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
 * Execute LSP-style requests against a TypeScript/JavaScript file.
 *
 * @remarks
 * Spawns a TypeScript 7 native server, opens the target file, sends each
 * request via the TS 7 API, then stops the server. Each request is
 * independent — if one fails, the others still run.
 *
 * @param input - Execute mode input with file and requests
 * @returns File path and results array matching requests order
 *
 * @public
 */
const executeLsp = async (input: LspInput & { mode: 'execute' }): Promise<z.infer<typeof ExecuteOutputSchema>> => {
  if (input.mode !== 'execute') {
    throw new Error('executeLsp requires mode: execute')
  }

  const rootDir = resolve(input.rootDir)
  const absolutePath = resolveFilePath(input.file, rootDir)

  const file = Bun.file(absolutePath)
  if (!(await file.exists())) {
    throw new Error(`File not found: ${absolutePath}`)
  }

  const api = new API({ cwd: rootDir })

  try {
    const snap = await api.updateSnapshot({ openFiles: [absolutePath] })

    try {
      const results: Array<{ method: string; result?: unknown; error?: string }> = []

      for (const req of input.requests) {
        try {
          const handler = METHOD_HANDLERS[req.method]
          if (!handler) {
            results.push({ method: req.method, error: `Unsupported method: ${req.method}` })
            continue
          }

          const result = await handler({
            snapshot: snap,
            rootDir,
            requestParams: (req.params as Record<string, unknown>) ?? {},
          })
          results.push({ method: req.method, result })
        } catch (error) {
          results.push({
            method: req.method,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      return { mode: 'execute', file: makeDisplayPath(absolutePath, rootDir), results }
    } finally {
      snap.dispose()
    }
  } finally {
    await sleep(200)
    await api.close().catch(() => {})
  }
}

// ============================================================================
// discover — list server capabilities
// ============================================================================

/**
 * Discover supported LSP methods from TypeScript 7's native API.
 *
 * @remarks
 * No server spawn needed — the supported methods are derived from the
 * Checker/Program API surface exposed by TypeScript 7.
 *
 * @internal
 */
const handleDiscover = async (_rootDir: string): Promise<LspOutput> => {
  const capabilities = Object.entries(CAPABILITY_TO_METHOD).map(([capability, method]) => ({
    method,
    capability,
  }))

  return { mode: 'discover', capabilities }
}

export const TYPESCRIPT_LSP_EXECUTE_TOOL_NAME = 'typescript_lsp_execute'
export const lspExecute = useMCPServer((server) => {
  server.registerTool(
    TYPESCRIPT_LSP_EXECUTE_TOOL_NAME,
    {
      description: 'Open a file and run LSP methods against TypeScript 7',
      inputSchema: z.object({
        file: z.string().min(1).describe('Path to a TypeScript/JavaScript file'),
        rootDir: z.string().optional().describe('Workspace root for file:// URI resolution'),
        requests: z
          .array(
            z.object({
              method: z.string().describe('LSP method name, e.g. textDocument/documentSymbol'),
              params: z.unknown().optional().describe('LSP method params'),
            }),
          )
          .min(1)
          .describe('Requests to execute in a single session'),
      }),
      outputSchema: z.object({
        mode: z.literal('execute'),
        file: z.string(),
        results: z.array(
          z.object({
            method: z.string(),
            result: z.unknown().optional(),
            error: z.string().optional(),
          }),
        ),
        message: z.string().optional().describe('info or error detail'),
        isError: z.boolean().optional().describe('true when the operation failed'),
      }),
    },
    async ({ file, rootDir, requests }) => {
      try {
        const output = await executeLsp({
          mode: 'execute',
          file,
          rootDir: rootDir ?? '.',
          requests: requests,
        })
        const emptyResults = output.results.filter((r) => r.result === undefined && !r.error)
        if (emptyResults.length > 0) {
          const methods = emptyResults.map((r) => r.method).join(', ')
          output.message = `[Info: no result returned for: ${methods}]`
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output,
        }
      } catch (err) {
        const output = {
          mode: 'execute' as const,
          file,
          results: [],
          message: `[Error: LSP execute failed: ${(err as Error).message}]`,
          isError: true,
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output,
        }
      }
    },
  )
})

export const TYPESCRIPT_LSP_DISCOVER_TOOL_NAME = 'typescript_lsp_discover'
export const lspDiscover = useMCPServer((server) => {
  server.registerTool(
    TYPESCRIPT_LSP_DISCOVER_TOOL_NAME,
    {
      description: 'List supported LSP methods from TypeScript 7',
      inputSchema: z.object({
        rootDir: z.string().optional().describe('Workspace root for file:// URI resolution'),
      }),
      outputSchema: z.object({
        mode: z.literal('discover'),
        capabilities: z.array(
          z.object({
            method: z.string(),
            capability: z.string(),
          }),
        ),
        message: z.string().optional().describe('info or error detail'),
        isError: z.boolean().optional().describe('true when the operation failed'),
      }),
    },
    async ({ rootDir }) => {
      try {
        const output = await handleDiscover(rootDir ?? '.')
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output,
        }
      } catch (err) {
        const output = {
          mode: 'discover' as const,
          capabilities: [],
          message: `[Error: LSP discover failed: ${(err as Error).message}]`,
          isError: true,
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output,
        }
      }
    },
  )
})
