#!/usr/bin/env bun
/**
 * Validate generated bThread factory files (goals, constitution/DAC, workflows).
 *
 * @remarks
 * Offline CLI tool — no agent pipeline. Checks TypeScript factories for
 * correctness, brand consistency, import sandboxing, purity, name collisions,
 * and companion test existence/pass.
 *
 * @public
 */

import { basename, dirname, join, resolve } from 'node:path'
import * as z from 'zod'
import { parseCli } from './cli.utils.ts'

// ============================================================================
// Types
// ============================================================================

/**
 * Result of validating a bThread factory file.
 *
 * @public
 */
export type ThreadValidationResult = {
  valid: boolean
  path: string
  errors: string[]
  warnings: string[]
  factory?: {
    brand: string
    name: string
    threadNames: string[]
  }
}

// ============================================================================
// Schemas
// ============================================================================

const ValidateThreadInputSchema = z.object({
  paths: z
    .array(z.string())
    .optional()
    .describe('Paths to validate (defaults to .memory/goals/, .memory/constitution/dac/)'),
})

const ValidateThreadOutputSchema = z.array(
  z.object({
    valid: z.boolean().describe('Whether the factory passed validation'),
    path: z.string().describe('Absolute path to the factory file'),
    errors: z.array(z.string()).describe('Validation errors'),
    warnings: z.array(z.string()).describe('Non-blocking warnings'),
    factory: z
      .object({
        brand: z.string(),
        name: z.string(),
        threadNames: z.array(z.string()),
      })
      .optional()
      .describe('Extracted factory metadata (only present when valid)'),
  }),
)

export { ValidateThreadInputSchema, ValidateThreadOutputSchema }

// ============================================================================
// Constants
// ============================================================================

/** Brand → directory mapping for bThread factories */
const BRAND_DIRECTORY_MAP: Record<string, string[]> = {
  '\u{1F3DB}\u{FE0F}': ['constitution', 'dac'],
  '\u{1F3AF}': ['goals'],
  '\u{1F504}': ['workflows'],
}

/** Allowed import source prefixes for sandboxed factories */
const ALLOWED_IMPORT_PREFIXES = [
  '../behavioral/',
  '../../behavioral/',
  '../agent/',
  '../../agent/',
  'behavioral/',
  'agent/',
]

/** Impure APIs that factories must not use */
const IMPURE_PATTERNS = [
  /\bfetch\s*\(/,
  /\bBun\.write\b/,
  /\bBun\.spawn\b/,
  /\bBun\.\$\b/,
  /\bconsole\.\w+\s*\(/,
  /\bprocess\.exit\b/,
]

// ============================================================================
// Individual Checks
// ============================================================================

/**
 * Check 1: Parse — valid TypeScript via Bun.Transpiler.
 *
 * @internal
 */
const checkParse = (source: string, path: string): { ok: boolean; error?: string } => {
  try {
    const transpiler = new Bun.Transpiler({ loader: 'ts' })
    transpiler.transformSync(source)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: `Parse error in ${basename(path)}: ${e instanceof Error ? e.message : String(e)}` }
  }
}

/**
 * Check 2: Brand — `$` field matches directory context.
 *
 * @internal
 */
const checkBrand = (source: string, filePath: string): { ok: boolean; brand?: string; error?: string } => {
  const brandMatch = source.match(/\$\s*:\s*['"`]([^'"`]+)['"`]/)
  if (!brandMatch) {
    return { ok: false, error: 'No brand field ($) found in factory export' }
  }
  const brand = brandMatch[1]!
  const dirParts = filePath.split('/')
  const expectedDirs = BRAND_DIRECTORY_MAP[brand]
  if (!expectedDirs) {
    return {
      ok: false,
      brand,
      error: `Unknown brand '${brand}' — expected one of: ${Object.keys(BRAND_DIRECTORY_MAP).join(', ')}`,
    }
  }
  const inCorrectDir = dirParts.some((part) => expectedDirs.includes(part))
  if (!inCorrectDir) {
    return {
      ok: false,
      brand,
      error: `Brand '${brand}' expects directory containing one of [${expectedDirs.join(', ')}], got path: ${filePath}`,
    }
  }
  return { ok: true, brand }
}

/**
 * Check 3: Sandbox — imports only from behavioral/ and agent/ modules.
 *
 * @internal
 */
const checkSandbox = (source: string): { ok: boolean; errors: string[] } => {
  const errors: string[] = []
  const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g
  for (const match of source.matchAll(importRegex)) {
    const specifier = match[1]!
    if (specifier.startsWith('.')) {
      // Relative imports — allow only behavioral/ and agent/ paths
      const isAllowed = ALLOWED_IMPORT_PREFIXES.some((prefix) => specifier.startsWith(prefix))
      if (!isAllowed) {
        errors.push(`Disallowed import: '${specifier}' — factories may only import from behavioral/ and agent/`)
      }
    }
    // Bare specifiers (packages) are allowed — they resolve to node_modules
  }
  return { ok: errors.length === 0, errors }
}

/**
 * Check 4: Purity — no fetch, Bun.write, Bun.spawn in factory body.
 *
 * @internal
 */
const checkPurity = (source: string): { ok: boolean; errors: string[] } => {
  const errors: string[] = []
  for (const pattern of IMPURE_PATTERNS) {
    if (pattern.test(source)) {
      errors.push(`Impure API detected: ${pattern.source}`)
    }
  }
  return { ok: errors.length === 0, errors }
}

/**
 * Check 5: Name collision — thread names don't shadow well-known threads.
 *
 * @internal
 */
const checkNameCollision = (source: string): { ok: boolean; warnings: string[]; threadNames: string[] } => {
  const warnings: string[] = []
  const threadNames: string[] = []
  // Match thread names from bThreads.set({ name: bThread(...) })
  const threadSetRegex = /(\w+)\s*:\s*bThread\s*\(/g
  for (const match of source.matchAll(threadSetRegex)) {
    threadNames.push(match[1]!)
  }
  const wellKnown = new Set(['taskGate', 'sessionGate', 'maxIterations', 'batchCompletion'])
  for (const name of threadNames) {
    if (wellKnown.has(name)) {
      warnings.push(`Thread name '${name}' shadows a well-known agent thread`)
    }
  }
  return { ok: true, warnings, threadNames }
}

/**
 * Check 6: Tests pass — companion `.spec.ts` exists and `bun test` exits 0.
 *
 * @internal
 */
const checkTests = async (factoryPath: string): Promise<{ ok: boolean; error?: string }> => {
  const specPath = factoryPath.replace(/\.ts$/, '.spec.ts')
  if (!(await Bun.file(specPath).exists())) {
    return { ok: false, error: `Missing companion test: ${basename(specPath)}` }
  }
  try {
    const result = Bun.spawnSync(['bun', 'test', specPath], {
      cwd: dirname(factoryPath),
      stdout: 'pipe',
      stderr: 'pipe',
    })
    if (result.exitCode !== 0) {
      const stderr = result.stderr.toString().trim()
      return { ok: false, error: `Tests failed for ${basename(specPath)}: ${stderr.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: `Failed to run tests: ${e instanceof Error ? e.message : String(e)}` }
  }
}

// ============================================================================
// Core Validation
// ============================================================================

/**
 * Validate a single bThread factory file.
 *
 * @param factoryPath - Absolute path to the `.ts` factory file
 * @returns Validation result with errors, warnings, and extracted metadata
 *
 * @public
 */
export const validateThreadFactory = async (factoryPath: string): Promise<ThreadValidationResult> => {
  const result: ThreadValidationResult = {
    valid: false,
    path: factoryPath,
    errors: [],
    warnings: [],
  }

  if (!(await Bun.file(factoryPath).exists())) {
    result.errors.push(`File does not exist: ${factoryPath}`)
    return result
  }

  const source = await Bun.file(factoryPath).text()

  // Check 1: Parse
  const parse = checkParse(source, factoryPath)
  if (!parse.ok) {
    result.errors.push(parse.error!)
    return result
  }

  // Check 2: Brand
  const brand = checkBrand(source, factoryPath)
  if (!brand.ok) {
    result.errors.push(brand.error!)
  }

  // Check 3: Sandbox
  const sandbox = checkSandbox(source)
  result.errors.push(...sandbox.errors)

  // Check 4: Purity
  const purity = checkPurity(source)
  result.errors.push(...purity.errors)

  // Check 5: Name collision
  const names = checkNameCollision(source)
  result.warnings.push(...names.warnings)

  // Check 6: Tests
  const tests = await checkTests(factoryPath)
  if (!tests.ok) {
    result.errors.push(tests.error!)
  }

  if (result.errors.length === 0) {
    result.valid = true
    const factoryName = basename(factoryPath, '.ts')
    result.factory = {
      brand: brand.brand ?? 'unknown',
      name: factoryName,
      threadNames: names.threadNames,
    }
  }

  return result
}

// ============================================================================
// Directory Scanner
// ============================================================================

/**
 * Find `.ts` factory files in a directory (excludes `.spec.ts` and `.test.ts`).
 *
 * @internal
 */
const findFactoryFiles = async (dir: string): Promise<string[]> => {
  const glob = new Bun.Glob('**/*.ts')
  const files: string[] = []
  for await (const path of glob.scan({ cwd: dir, onlyFiles: true })) {
    if (!path.endsWith('.spec.ts') && !path.endsWith('.test.ts')) {
      files.push(resolve(dir, path))
    }
  }
  return files.sort()
}

/**
 * Validate all factory files under given paths.
 *
 * @public
 */
export const validateThreads = async (searchPaths: string[], cwd: string): Promise<ThreadValidationResult[]> => {
  const results: ThreadValidationResult[] = []

  for (const searchPath of searchPaths) {
    const fullPath = searchPath.startsWith('/') ? searchPath : join(cwd, searchPath)
    const file = Bun.file(fullPath)

    if (fullPath.endsWith('.ts') && (await file.exists())) {
      results.push(await validateThreadFactory(fullPath))
    } else {
      const files = await findFactoryFiles(fullPath)
      for (const f of files) {
        results.push(await validateThreadFactory(f))
      }
    }
  }

  return results
}

// ============================================================================
// CLI Handler
// ============================================================================

/**
 * CLI entry point for validate-thread.
 *
 * @remarks
 * Exit 0 = all valid, 1 = validation errors, 2 = bad input.
 *
 * @param args - CLI arguments (after command name)
 *
 * @public
 */
export const validateThreadCli = async (args: string[]) => {
  if (args.includes('--help') || args.includes('-h')) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log(`plaited validate-thread
Validate bThread factory files (goals, constitution/DAC, workflows)

Usage: plaited validate-thread '<json>' [options]
       echo '<json>' | plaited validate-thread

Input (JSON):
  paths    string[]   Paths to validate (default: .memory/goals/, .memory/constitution/dac/)

Options:
  --schema <input|output>  Print JSON Schema and exit
  -h, --help               Show this help

Exit codes:
  0  All factories valid (or --schema/--help)
  1  Validation errors found
  2  Bad input or tool error

Checks:
  1. Parse — valid TypeScript
  2. Brand — $ field matches directory
  3. Sandbox — imports only from behavioral/ and agent/
  4. Purity — no fetch, Bun.write, Bun.spawn
  5. Name collision — no shadowing of well-known threads
  6. Tests — companion .spec.ts exists and passes`)
    return
  }

  const input = await parseCli(args.length === 0 && process.stdin.isTTY ? ['{}'] : args, ValidateThreadInputSchema, {
    name: 'validate-thread',
    outputSchema: ValidateThreadOutputSchema,
  })

  const cwd = process.cwd()
  const searchPaths = input.paths?.length
    ? input.paths
    : [join(cwd, '.memory/goals'), join(cwd, '.memory/constitution/dac')]
  const results = await validateThreads(searchPaths, cwd)

  // biome-ignore lint/suspicious/noConsole: CLI output
  console.log(JSON.stringify(results, null, 2))
  if (results.some((r) => !r.valid)) process.exit(1)
}

if (import.meta.main) {
  await validateThreadCli(Bun.argv.slice(2))
}
