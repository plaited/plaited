/**
 * CLI for AST-based TSDoc auditing on TypeScript source files.
 *
 * @remarks
 * Runs four operations in a single pass against the given targets:
 * missing-docs, public-exports, orphaned-docs, and doc-coverage.
 *
 * @internal
 */

import { join } from 'node:path'
import ts from 'typescript'
import * as z from 'zod'
import { makeCli } from './cli.ts'

// ============================================================================
// Types
// ============================================================================

type ExportedDeclaration = {
  documented: boolean
  file: string
  kind: string
  line: number
  name: string
}

type OrphanedComment = {
  file: string
  line: number
  preview: string
}

type DocumentationResult = {
  type: string
  data?: unknown
  error?: string
}

// ============================================================================
// Schema
// ============================================================================

const CodeDocumentationInputSchema = z
  .object({
    targets: z.array(z.string()).min(1).describe('File paths or glob patterns to audit'),
  })
  .describe('Code documentation audit input — targets to scan for TSDoc coverage')

const CoverageResultSchema = z.object({
  file: z.string(),
  exported: z.number(),
  documented: z.number(),
  undocumented: z.number(),
  percentage: z.number(),
})

const DocumentationResultSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('missing-docs'),
    data: z
      .array(
        z.object({
          documented: z.boolean(),
          file: z.string(),
          kind: z.string(),
          line: z.number(),
          name: z.string(),
        }),
      )
      .optional(),
    error: z.string().optional(),
  }),
  z.object({
    type: z.literal('public-exports'),
    data: z
      .array(
        z.object({
          documented: z.boolean(),
          file: z.string(),
          kind: z.string(),
          line: z.number(),
          name: z.string(),
        }),
      )
      .optional(),
    error: z.string().optional(),
  }),
  z.object({
    type: z.literal('orphaned-docs'),
    data: z
      .array(
        z.object({
          file: z.string(),
          line: z.number(),
          preview: z.string(),
        }),
      )
      .optional(),
    error: z.string().optional(),
  }),
  z.object({
    type: z.literal('doc-coverage'),
    data: z.array(CoverageResultSchema).optional(),
    error: z.string().optional(),
  }),
])

const CodeDocumentationOutputSchema = z
  .object({
    targets: z.array(z.string()).describe('Resolved audit targets'),
    results: z.array(DocumentationResultSchema).describe('Results for each of the four audit operations'),
  })
  .describe('Code documentation audit output — coverage, exports, and orphaned docs')

// ============================================================================
// Helpers
// ============================================================================

const resolvePath = (value: string, base?: string): string => {
  if (value.startsWith('/')) return value
  return join(base ?? process.cwd(), value)
}

const hasGlobSyntax = (value: string): boolean => /[*?[\]{}]/.test(value)

const resolveTargets = async (targets: string[], base?: string): Promise<string[]> => {
  const resolved = new Set<string>()

  for (const target of targets) {
    if (hasGlobSyntax(target)) {
      const glob = new Bun.Glob(target)
      for await (const file of glob.scan({ cwd: base ?? process.cwd(), absolute: true, onlyFiles: true })) {
        resolved.add(file)
      }
      continue
    }

    const absolutePath = resolvePath(target, base)
    const file = Bun.file(absolutePath)
    if (await file.exists()) {
      resolved.add(absolutePath)
    }
  }

  return [...resolved].sort()
}

const getStatementDocs = (statement: ts.Statement): ts.JSDoc[] =>
  ts.getJSDocCommentsAndTags(statement).filter(ts.isJSDoc)

const getDeclarationKind = (statement: ts.Statement): string => {
  if (ts.isFunctionDeclaration(statement)) return 'Function'
  if (ts.isTypeAliasDeclaration(statement)) return 'TypeAlias'
  if (ts.isClassDeclaration(statement)) return 'Class'
  if (ts.isInterfaceDeclaration(statement)) return 'Interface'
  if (ts.isEnumDeclaration(statement)) return 'Enum'
  if (ts.isVariableStatement(statement)) return 'Variable'
  if (ts.isExportDeclaration(statement)) return 'ExportDeclaration'
  return ts.SyntaxKind[statement.kind] ?? 'Unknown'
}

const getExportedDeclarations = (file: string, sourceFile: ts.SourceFile): ExportedDeclaration[] => {
  const declarations: ExportedDeclaration[] = []

  for (const statement of sourceFile.statements) {
    const isExported =
      ts.canHaveModifiers(statement) &&
      !!ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    if (!isExported || ts.isExportAssignment(statement) || ts.isExportDeclaration(statement)) continue

    const documented = getStatementDocs(statement).length > 0
    const kind = getDeclarationKind(statement)
    const line = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile)).line + 1

    if (
      ts.isFunctionDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isEnumDeclaration(statement)
    ) {
      if (!statement.name) continue
      declarations.push({
        documented,
        file,
        kind,
        line,
        name: statement.name.text,
      })
      continue
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue
        declarations.push({
          documented,
          file,
          kind,
          line,
          name: declaration.name.text,
        })
      }
    }
  }

  return declarations
}

const collectAttachedDocStarts = (sourceFile: ts.SourceFile): Set<number> => {
  const starts = new Set<number>()

  const visit = (node: ts.Node) => {
    if (ts.isSourceFile(node) || node.kind === ts.SyntaxKind.EndOfFileToken) {
      ts.forEachChild(node, visit)
      return
    }

    for (const tag of ts.getJSDocCommentsAndTags(node)) {
      if (ts.isJSDoc(tag)) {
        starts.add(tag.getStart(sourceFile))
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return starts
}

const getOrphanedComments = (file: string, sourceFile: ts.SourceFile): OrphanedComment[] => {
  const attachedStarts = collectAttachedDocStarts(sourceFile)
  const comments: OrphanedComment[] = []
  const pattern = /\/\*\*[\s\S]*?\*\//g

  for (const match of sourceFile.text.matchAll(pattern)) {
    const index = match.index
    if (index === undefined || attachedStarts.has(index)) continue

    const text = match[0] ?? ''
    const preview = text
      .split('\n')
      .map((line) =>
        line
          .replace(/^\s*\/?\**\s?/, '')
          .replace(/\*\/\s*$/, '')
          .trim(),
      )
      .find(Boolean)
    const line = sourceFile.getLineAndCharacterOfPosition(index).line + 1

    comments.push({
      file,
      line,
      preview: preview ?? '',
    })
  }

  return comments
}

// ============================================================================
// Audit execution
// ============================================================================

const runAudit = async (targets: string[]): Promise<{ targets: string[]; results: DocumentationResult[] }> => {
  const resolvedTargets = await resolveTargets(targets)
  const sourceFiles = await Promise.all(
    resolvedTargets.map(async (file) => {
      const text = await Bun.file(file).text()
      return {
        file,
        sourceFile: ts.createSourceFile(
          file,
          text,
          ts.ScriptTarget.Latest,
          true,
          file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        ),
      }
    }),
  )

  const results: DocumentationResult[] = []

  // public-exports
  results.push({
    type: 'public-exports',
    data: sourceFiles.flatMap(({ file, sourceFile }) => getExportedDeclarations(file, sourceFile)),
  })

  // missing-docs
  results.push({
    type: 'missing-docs',
    data: sourceFiles.flatMap(({ file, sourceFile }) =>
      getExportedDeclarations(file, sourceFile).filter((declaration) => !declaration.documented),
    ),
  })

  // orphaned-docs
  results.push({
    type: 'orphaned-docs',
    data: sourceFiles.flatMap(({ file, sourceFile }) => getOrphanedComments(file, sourceFile)),
  })

  // doc-coverage
  results.push({
    type: 'doc-coverage',
    data: sourceFiles.map(({ file, sourceFile }) => {
      const declarations = getExportedDeclarations(file, sourceFile)
      const exported = declarations.length
      const documented = declarations.filter((declaration) => declaration.documented).length
      const undocumented = exported - documented
      return {
        file,
        exported,
        documented,
        undocumented,
        percentage: exported === 0 ? 100 : Math.round((documented / exported) * 10000) / 100,
      }
    }),
  })

  return {
    targets: resolvedTargets,
    results,
  }
}

// ============================================================================
// CLI handler
// ============================================================================

const run = async (input: z.infer<typeof CodeDocumentationInputSchema>) => runAudit(input.targets)

export const codeDocumentationCli = makeCli({
  name: 'code-documentation',
  inputSchema: CodeDocumentationInputSchema,
  outputSchema: CodeDocumentationOutputSchema,
  help: [
    'AST-based TSDoc audit and maintenance tool.',
    '',
    'Runs four operations in a single pass:',
    '  missing-docs    Exported declarations without attached JSDoc/TSDoc',
    '  public-exports  All exported top-level declarations with doc status',
    '  orphaned-docs   JSDoc blocks not attached to any AST node',
    '  doc-coverage    Per-file exported declaration coverage summary',
    '',
    'Input (JSON):',
    '  targets  string[]  File paths or glob patterns to audit (required)',
    '',
    'Examples:',
    '  onbraid code-documentation \'{"targets":["src/**/*.ts"]}\'',
    '  onbraid code-documentation \'{"targets":["src/agent/agent.ts"]}\'',
  ].join('\n'),
  run,
})
