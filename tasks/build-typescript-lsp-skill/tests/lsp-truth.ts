/**
 * Verifier truth script for the build-typescript-lsp-skill task.
 *
 * Recomputes the expected documentSymbol output and a hover position from the
 * fixture file using the preinstalled TypeScript 7 native API — no stored
 * golden blob. Copied into /app by the verifier at grading time so that
 * `typescript/unstable/*` resolves through /app/node_modules.
 *
 * Usage: bun .verifier-lsp-truth.ts <fixture-abs-path> <rootDir>
 * Output: single JSON object on stdout:
 * { file, rootDir, symbols: [{ name, kind, range: [start, end] }],
 *   hover: { line, character, name } }
 */

import { isAbsolute, relative, resolve } from 'node:path'
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
import { API } from 'typescript/unstable/async'

const SYMBOL_KIND_NAMES: Record<number, string> = {
  [SyntaxKind.VariableStatement]: 'Variable',
  [SyntaxKind.FunctionDeclaration]: 'Function',
  [SyntaxKind.ClassDeclaration]: 'Class',
  [SyntaxKind.InterfaceDeclaration]: 'Interface',
  [SyntaxKind.TypeAliasDeclaration]: 'TypeAlias',
  [SyntaxKind.EnumDeclaration]: 'Enum',
  [SyntaxKind.ModuleDeclaration]: 'Module',
}

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

const extractDocumentSymbols = (
  sourceFile: SourceFile,
): Array<{ name: string; kind: string; range: [number, number] }> => {
  const symbols: Array<{ name: string; kind: string; range: [number, number] }> = []
  for (const stmt of sourceFile.statements) {
    const name = extractNameFromStatement(stmt, sourceFile)
    if (!name) continue
    const kindName = SYMBOL_KIND_NAMES[stmt.kind] ?? `Unknown(${stmt.kind})`
    symbols.push({ name, kind: kindName, range: [stmt.getStart(sourceFile), stmt.getEnd()] })
  }
  return symbols
}

const findSymbolNameNode = (
  sourceFile: SourceFile,
  symbolName: string,
): { line: number; character: number } | undefined => {
  for (const stmt of sourceFile.statements) {
    if ((isFunctionDeclaration(stmt) || isClassDeclaration(stmt)) && stmt.name?.text === symbolName) {
      const pos = sourceFile.getLineAndCharacterOfPosition(stmt.name.getStart(sourceFile))
      return { line: pos.line, character: pos.character }
    }
  }
  return
}

const main = async (): Promise<void> => {
  const [fixtureArg, rootDirArg] = process.argv.slice(2)
  if (!fixtureArg) {
    console.error('usage: bun .verifier-lsp-truth.ts <fixture-abs-path> <rootDir>')
    process.exit(2)
  }
  const rootDir = resolve(rootDirArg ?? '.')
  const absolutePath = isAbsolute(fixtureArg) ? resolve(fixtureArg) : resolve(rootDir, fixtureArg)

  const api = new API({ cwd: rootDir })
  try {
    const snap = await api.updateSnapshot({ openFiles: [absolutePath] })
    try {
      const projects = snap.getProjects()
      const project = projects.find((p) => p.rootFiles?.includes(absolutePath)) ?? projects[0]
      if (!project) throw new Error(`No project found for ${absolutePath}`)
      const sourceFile = await project.program.getSourceFile(absolutePath)
      if (!sourceFile) throw new Error(`Source file not found: ${absolutePath}`)

      const symbols = extractDocumentSymbols(sourceFile)
      const hoverNode = findSymbolNameNode(sourceFile, 'formatValue')
      if (!hoverNode) throw new Error('formatValue not found in fixture')

      const relativeFile = relative(rootDir, absolutePath).replace(/\\/g, '/')
      console.log(
        JSON.stringify({
          file: relativeFile,
          rootDir,
          symbols,
          hover: { ...hoverNode, name: 'formatValue' },
        }),
      )
    } finally {
      snap.dispose()
    }
  } finally {
    await new Promise((r) => setTimeout(r, 200))
    await api.close().catch(() => {})
  }
}

await main()
