/**
 * Unified code-documentation audit tool.
 *
 * @remarks
 * Provides AST-based TSDoc maintenance operations for exported declarations and
 * JSDoc blocks. Accepts JSON positional arg or stdin pipe. `--schema
 * input|output` exposes the JSON contracts for automation.
 *
 * @public
 */

import { join } from 'node:path'
import { parseCli } from 'plaited/cli'
import ts from 'typescript'
import * as z from 'zod'

type DocumentationOperation = z.infer<typeof DocumentationOperationSchema>
type DocumentationInput = z.infer<typeof DocumentationInputSchema>
type DocumentationResult = {
  type: string
  data?: unknown
  error?: string
}
type DocumentationOutput = {
  targets: string[]
  results: DocumentationResult[]
}

export type { DocumentationInput, DocumentationOperation, DocumentationOutput, DocumentationResult }

/** @public */
const DocumentationOperationSchema = z.object({
  type: z
    .enum(['missing-docs', 'public-exports', 'orphaned-docs', 'doc-coverage'])
    .describe('Documentation audit operation to perform'),
})

/** @public */
const DocumentationInputSchema = z.object({
  targets: z.array(z.string()).min(1).describe('File paths or glob patterns to audit'),
})

/** @public */
const DocumentationOutputSchema = z.object({
  targets: z.array(z.string()).describe('Resolved audit targets'),
  results: z
    .array(
      z.object({
        type: z.string().describe('Operation type that was performed'),
        error: z.string().optional().describe('Error message if the operation failed'),
      }),
    )
    .describe('Results array for each requested operation'),
})

export { DocumentationInputSchema, DocumentationOperationSchema, DocumentationOutputSchema }

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

const executeDocumentationAudit = async (
  input: DocumentationInput,
  operations: DocumentationOperation[],
): Promise<DocumentationOutput> => {
  const targets = await resolveTargets(input.targets)
  const sourceFiles = await Promise.all(
    targets.map(async (file) => {
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

  for (const operation of operations) {
    try {
      switch (operation.type) {
        case 'public-exports': {
          results.push({
            type: operation.type,
            data: sourceFiles.flatMap(({ file, sourceFile }) => getExportedDeclarations(file, sourceFile)),
          })
          break
        }
        case 'missing-docs': {
          results.push({
            type: operation.type,
            data: sourceFiles.flatMap(({ file, sourceFile }) =>
              getExportedDeclarations(file, sourceFile).filter((declaration) => !declaration.documented),
            ),
          })
          break
        }
        case 'orphaned-docs': {
          results.push({
            type: operation.type,
            data: sourceFiles.flatMap(({ file, sourceFile }) => getOrphanedComments(file, sourceFile)),
          })
          break
        }
        case 'doc-coverage': {
          results.push({
            type: operation.type,
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
          break
        }
      }
    } catch (error) {
      results.push({
        type: operation.type,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    targets,
    results,
  }
}

export { executeDocumentationAudit, getExportedDeclarations, getOrphanedComments, resolvePath, resolveTargets }

/**
 * CLI entry point for the code-documentation skill.
 *
 * @public
 */
export const codeDocumentationCli = async (args: string[]) => {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`code-documentation skill
AST-based TSDoc audit and maintenance helper

Usage: bun skills/code-documentation/scripts/run.ts '<json>' [options]
       echo '<json>' | bun skills/code-documentation/scripts/run.ts

Input (JSON):
  targets      string[]            File paths or glob patterns to audit

Operations:
  missing-docs   exported declarations without attached JSDoc/TSDoc
  public-exports exported top-level declarations with documentation status
  orphaned-docs  JSDoc blocks not attached to an AST node
  doc-coverage   per-file exported declaration coverage summary

Options:
  --schema <input|output>  Print JSON Schema and exit
  -h, --help               Show this help

Run the library API directly if you need multiple operations in one call.`)
    return
  }

  const input = await parseCli(args, DocumentationInputSchema, {
    name: 'code-documentation',
    outputSchema: DocumentationOutputSchema,
  })

  try {
    const result = await executeDocumentationAudit(input, [
      { type: 'missing-docs' },
      { type: 'public-exports' },
      { type: 'orphaned-docs' },
      { type: 'doc-coverage' },
    ])
    console.log(JSON.stringify(result, null, 2))
    if (result.results.some((entry) => entry.error)) process.exit(1)
  } catch (error) {
    console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
    process.exit(2)
  }
}

if (import.meta.main) {
  await codeDocumentationCli(Bun.argv.slice(2))
}
