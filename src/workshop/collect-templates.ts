/**
 * @internal
 * @module collect-templates
 *
 * Purpose: Fast template collection using direct module imports (runtime analysis)
 * Architecture: Alternative to TypeScript compilation-based discovery
 * Performance: ~30x faster than TypeScript compilation approach
 *
 * Key differences from discover-template-metadata.ts:
 * - Uses dynamic imports instead of TypeScript compiler
 * - Analyzes runtime objects instead of AST
 * - ~50ms vs ~1500ms for typical project
 *
 * Trade-offs:
 * - Pros: Much faster, simpler code, no TypeScript dependency
 * - Cons: Requires template files to be executable, runtime errors if invalid
 *
 * Usage:
 * - Use for build tools and MCP (performance critical)
 * - Consider discover-template-metadata.ts for static analysis tools if needed
 */

import { Glob } from 'bun'
import { BEHAVIORAL_TEMPLATE_IDENTIFIER } from '../main/b-element.constants.js'
import type { TemplateExport } from './workshop.types.js'

/**
 * @internal
 * Type guard to check if a value is a BehavioralTemplate.
 * Validates presence of required properties at runtime.
 *
 * BehavioralTemplates are functions with properties attached to them.
 *
 * @param value - Value to check (can be function or object)
 * @returns true if value is a valid BehavioralTemplate
 */
const isBehavioralTemplate = (value: unknown): boolean => {
  // BehavioralTemplates are functions with properties, so accept both 'function' and 'object'
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
    return false
  }

  const obj = value as Record<string, unknown>

  // Check for BehavioralTemplate identifier
  if (obj.$ !== BEHAVIORAL_TEMPLATE_IDENTIFIER) {
    return false
  }

  // Check for required BehavioralTemplate properties
  if (typeof obj.tag !== 'string') {
    return false
  }

  if (!(obj.registry instanceof Set)) {
    return false
  }

  if (!Array.isArray(obj.observedAttributes)) {
    return false
  }

  if (!Array.isArray(obj.publicEvents)) {
    return false
  }

  return true
}

/**
 * @internal
 * Discovers files matching a glob pattern within a directory.
 * Uses Bun's Glob API for efficient file discovery.
 *
 * @param cwd - The directory to search in
 * @param pattern - Glob pattern to match files against
 * @returns Array of absolute file paths matching the pattern
 */
const globFiles = async (cwd: string, pattern: string): Promise<string[]> => {
  const glob = new Glob(pattern)
  const paths = await Array.fromAsync(glob.scan({ cwd }))
  return paths.map((path) => Bun.resolveSync(`./${path}`, cwd))
}

/**
 * Collects template metadata from a single file using direct module import.
 * Fast alternative to TypeScript compilation for runtime template discovery.
 *
 * @param filePath - Absolute path to the template file
 * @returns Array of template metadata (only BehavioralTemplates)
 *
 * @example Extract templates from a specific file
 * ```ts
 * const templates = await getTemplateMetadata('/path/to/Button.tsx');
 * // Returns: [{ exportName: 'Button', filePath: '...', type: 'BehavioralTemplate' }]
 * ```
 *
 * @remarks
 * - Uses dynamic import instead of TypeScript compiler
 * - Analyzes runtime objects instead of AST
 * - ~30x faster than TypeScript compilation approach
 * - Requires template files to be valid executable TypeScript/TSX
 * - Only returns BehavioralTemplate exports (not FunctionTemplates)
 *
 * @see {@link discoverTemplateMetadata} for directory-based discovery
 */
export const getTemplateMetadata = async (filePath: string): Promise<TemplateExport[]> => {
  const metadata: TemplateExport[] = []

  try {
    // Dynamic import to load the module
    const module = (await import(filePath)) as Record<string, unknown>

    // Check each export
    for (const [exportName, exportValue] of Object.entries(module)) {
      // Skip default exports
      if (exportName === 'default') {
        continue
      }

      // Check if this export is a BehavioralTemplate
      if (isBehavioralTemplate(exportValue)) {
        metadata.push({
          exportName,
          filePath,
          type: 'BehavioralTemplate',
        })
      }
    }
  } catch (error) {
    console.error(`Failed to import template file: ${filePath}`, error)
    throw error
  }

  return metadata
}

/**
 * Discovers all BehavioralTemplate files and their exports in a directory using direct imports.
 * Fast alternative to TypeScript compilation-based discovery.
 *
 * @param cwd - Current working directory (project root)
 * @returns Array of BehavioralTemplate export metadata
 *
 * @example
 * ```ts
 * const templates = await discoverTemplateMetadata('/project/root');
 * // Returns metadata for all BehavioralTemplates in *.tsx files
 * ```
 *
 * @remarks
 * - Uses direct imports for ~30x faster discovery than TypeScript compilation
 * - Files must be executable TypeScript/TSX
 * - Errors in template files will cause discovery to fail
 * - Automatically excludes *.stories.{ts,tsx} files
 * - Only returns BehavioralTemplate exports (not FunctionTemplates)
 *
 * @see {@link getTemplateMetadata} for single file collection
 */
export const discoverTemplateMetadata = async (cwd: string): Promise<TemplateExport[]> => {
  console.log(`🔍 Discovering template metadata in: ${cwd}`)

  // Get all .tsx files
  const allFiles = await globFiles(cwd, '**/*.tsx')

  // Filter out story files
  const excludeGlob = new Glob('**/*.stories.{ts,tsx}')
  const files = allFiles.filter((file) => !excludeGlob.match(file))

  if (files.length === 0) {
    throw new Error(`No template files (*.tsx) found in directory '${cwd}' (excluding **/*.stories.{ts,tsx})`)
  }

  console.log(`📄 Found ${files.length} template files`)

  // Collect metadata from all files in parallel
  const metadataArrays = await Promise.all(files.map((file) => getTemplateMetadata(file)))
  const metadata = metadataArrays.flat()

  console.log(`✅ Discovered ${metadata.length} BehavioralTemplate exports`)

  return metadata
}
