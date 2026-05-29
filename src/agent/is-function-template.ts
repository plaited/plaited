import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

// ============================================================================
// Import graph traversal via Bun.Transpiler
// ============================================================================

/** @internal */
const transpiler = new Bun.Transpiler({})

/**
 * Walks the ESM import graph from an entry file, collecting every reachable
 * local `.ts` source file that belongs to the same package.
 *
 * Uses `Bun.Transpiler#scan` for fast parse-free import/export extraction.
 *
 * @internal
 */
const collectReachableFiles = (entryPath: string, packageRoot: string): string[] => {
  const visited = new Set<string>()
  const queue: string[] = [entryPath]
  const files: string[] = []

  while (queue.length) {
    const current = queue.shift()
    if (!current || visited.has(current)) continue
    visited.add(current)

    if (!current.endsWith('.ts') && !current.endsWith('.tsx')) continue
    files.push(current)

    let scanned: { exports: string[]; imports: Array<{ kind: string; path: string }> }
    try {
      const source = readFileSync(current, 'utf-8')
      scanned = transpiler.scan(source)
    } catch {
      continue
    }

    for (const imp of scanned.imports) {
      if (imp.kind === 'bun') continue
      if (!imp.path.startsWith('.')) continue
      const resolved = join(dirname(current), imp.path)
      const resolvedExt = resolved.endsWith('.ts') ? resolved : `${resolved}.ts`
      if (resolvedExt.startsWith(packageRoot) && !visited.has(resolvedExt) && existsSync(resolvedExt)) {
        queue.push(resolvedExt)
      }
    }
  }

  return files
}

// ============================================================================
// TypeScript verification
// ============================================================================

/** @internal */
const hasTemplateObjectStructure = (checker: ts.TypeChecker, type: ts.Type): boolean => {
  if (!checker.getPropertyOfType(type, 'html')) return false
  if (!checker.getPropertyOfType(type, 'stylesheets')) return false
  if (!checker.getPropertyOfType(type, 'registry')) return false
  if (!checker.getPropertyOfType(type, '$')) return false
  if (!checker.getPropertyOfType(type, 'scale')) return false
  return true
}

/** @internal */
const symbolIsFunctionTemplate = (checker: ts.TypeChecker, symbol: ts.Symbol): boolean => {
  if (symbol.flags & ts.SymbolFlags.Alias) {
    const aliased = checker.getAliasedSymbol(symbol)
    if (aliased && aliased !== symbol) {
      symbol = aliased
    }
  }

  const decl = symbol.valueDeclaration ?? symbol.declarations?.[0]
  if (!decl) return false

  const type = checker.getTypeOfSymbolAtLocation(symbol, decl)
  const signatures = checker.getSignaturesOfType(type, ts.SignatureKind.Call)

  if (signatures.length !== 1) return false

  const sig = signatures[0]
  if (!sig) return false
  if (sig.parameters.length !== 1) return false

  const returnType = checker.getReturnTypeOfSignature(sig)
  return hasTemplateObjectStructure(checker, returnType)
}

/** @internal Walk up from a resolved file path to find the nearest package root. */
const findPackageRoot = (resolvedFile: string): string | undefined => {
  let dir = dirname(resolvedFile)
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'package.json'))) return dir
    dir = dirname(dir)
  }
  return undefined
}

// ============================================================================
// Public types
// ============================================================================

/** @public Result shape for discovered FunctionTemplate exports. */
export type FunctionTemplateInfo = {
  /** Export name. */
  name: string
  /** Source file path (absolute). */
  file: string
}

// ============================================================================
// Single public export
// ============================================================================

/**
 * Identifies FunctionTemplate exports from a package or subpath export.
 *
 * @remarks
 * Accepts a package specifier (e.g. `@plaited/templates`) that resolves via
 * `import.meta.resolve`. Subpath exports are supported — only files reachable
 * from the resolved subpath entry point are scanned.
 *
 * Uses `Bun.Transpiler#scan` to walk the import graph from the entry point,
 * then feeds all reachable source files into a single `ts.TypeChecker`.
 *
 * Detection criteria:
 * - Symbol is callable with exactly one call signature
 * - Signature arity is 1 (single `attrs` parameter)
 * - Return type structurally matches `TemplateObject`
 *   (has `html`, `stylesheets`, `registry`, `$`, `scale`)
 *
 * Re-exports are traced via `checker.getAliasedSymbol()`.
 * No functions are invoked.
 *
 * @param packageSpecifier - Package specifier or local directory path
 * @returns Array of discovered FunctionTemplate exports
 *
 * @public
 */
export const identifyFunctionTemplates = (packageSpecifier: string): FunctionTemplateInfo[] => {
  if (typeof packageSpecifier !== 'string') return []

  let entryPath: string

  // Try ESM resolution first (handles package specifiers and subpath exports).
  try {
    const resolved = fileURLToPath(import.meta.resolve(packageSpecifier))
    // If resolved to a directory, look for the package entry file.
    if (statSync(resolved).isDirectory()) {
      const pkgPath = join(resolved, 'package.json')
      if (!existsSync(pkgPath)) return []
      const pkgJson = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      const entry = pkgJson.exports ?? pkgJson.main ?? pkgJson.module ?? 'index.ts'
      entryPath = join(resolved, typeof entry === 'string' ? entry : (entry['.'] ?? 'index.ts'))
    } else {
      entryPath = resolved
    }
  } catch {
    // Fallback: local directory with a package.json.
    try {
      const stat = statSync(packageSpecifier)
      if (!stat.isDirectory()) return []
      const pkgPath = join(packageSpecifier, 'package.json')
      if (!existsSync(pkgPath)) return []
      const pkgJson = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      const entry = pkgJson.exports ?? pkgJson.main ?? pkgJson.module ?? 'index.ts'
      entryPath = join(packageSpecifier, typeof entry === 'string' ? entry : (entry['.'] ?? 'index.ts'))
    } catch {
      return []
    }
  }

  const packageRoot = findPackageRoot(entryPath)
  if (!packageRoot) return []

  // Collect all reachable source files via transpiler scan.
  const sourceFiles = collectReachableFiles(entryPath, packageRoot)
  if (!sourceFiles.length) return []

  // Run TSC on all reachable files.
  const program = ts.createProgram(sourceFiles, {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.Preserve,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    allowJs: true,
    noEmit: true,
    skipLibCheck: true,
  })
  const checker = program.getTypeChecker()
  const results: FunctionTemplateInfo[] = []

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue

    const moduleSymbol = checker.getSymbolAtLocation(sourceFile)
    if (!moduleSymbol) continue

    const exports = checker.getExportsOfModule(moduleSymbol)
    for (const symbol of exports) {
      if (symbolIsFunctionTemplate(checker, symbol)) {
        results.push({ name: symbol.getName(), file: sourceFile.fileName })
      }
    }
  }

  return results
}
