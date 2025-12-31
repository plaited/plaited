/**
 * @internal
 * @module collect-templates
 *
 * Fast template collection using direct module imports (runtime analysis).
 * Alternative to TypeScript compilation-based discovery.
 *
 * @remarks
 * Performance: ~30x faster than compilation approach (~50ms vs ~1500ms).
 * Trade-offs: Faster and simpler, but requires executable template files.
 * Use for build tools and MCP where performance is critical.
 */

import { statSync } from 'node:fs'
import { resolve } from 'node:path'
import { Glob } from 'bun'
import { type FunctionTemplate, isBehavioralTemplate } from '../main.ts'
import type { TemplateExport } from './workshop.types.ts'
import { globFiles } from './workshop.utils.ts'

/**
 * Collects template metadata from a single file using direct module import.
 * Fast alternative to TypeScript compilation for runtime template discovery.
 *
 * @param filePath - Absolute path to the template file
 * @returns Array of template metadata (only BehavioralTemplates)
 *
 * @remarks
 * - Uses dynamic import instead of TypeScript compiler
 * - Analyzes runtime objects instead of AST
 * - ~30x faster than TypeScript compilation approach
 * - Requires template files to be valid executable TypeScript/TSX
 * - Only returns BehavioralTemplate exports (not FunctionTemplates)
 *
 * @see {@link discoverBehavioralTemplateMetadata} for directory-based discovery
 */
export const getBehavioralTemplateMetadata = async (filePath: string): Promise<TemplateExport[]> => {
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
      if (isBehavioralTemplate(exportValue as FunctionTemplate)) {
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
 * @remarks
 * - Uses direct imports for ~30x faster discovery than TypeScript compilation
 * - Files must be executable TypeScript/TSX
 * - Errors in template files will cause discovery to fail
 * - Automatically excludes *.stories.{ts,tsx} files
 * - Only returns BehavioralTemplate exports (not FunctionTemplates)
 *
 * @see {@link getBehavioralTemplateMetadata} for single file collection
 */
export const discoverBehavioralTemplateMetadata = async (cwd: string): Promise<TemplateExport[]> => {
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
  const metadataArrays = await Promise.all(files.map((file) => getBehavioralTemplateMetadata(file)))
  const metadata = metadataArrays.flat()

  console.log(`✅ Discovered ${metadata.length} BehavioralTemplate exports`)

  return metadata
}

/**
 * Collects BehavioralTemplate metadata from provided file or directory paths.
 * Entry function that handles both individual files and directories.
 *
 * @param cwd - Current working directory (project root)
 * @param paths - Array of file or directory paths to scan
 * @returns Array of BehavioralTemplate export metadata
 *
 * @remarks
 * - Resolves paths relative to cwd
 * - For directories: uses discoverBehavioralTemplateMetadata (recursive scan)
 * - For files: uses getBehavioralTemplateMetadata (single file analysis)
 * - Uses direct imports for ~30x faster discovery than TypeScript compilation
 * - Exits process on path errors (ENOENT or other errors)
 *
 * @see {@link getBehavioralTemplateMetadata} for single file collection
 * @see {@link discoverBehavioralTemplateMetadata} for directory-based discovery
 */
export const collectBehavioralTemplates = async (cwd: string, paths: string[]): Promise<TemplateExport[]> => {
  console.log(`   Paths: ${paths.join(', ')}`)

  console.log('\n🔍 Discovering BehavioralTemplates from provided paths...')

  const allMetadata: TemplateExport[][] = []

  for (const pathArg of paths) {
    const absolutePath = resolve(cwd, pathArg)

    try {
      const stats = statSync(absolutePath)

      if (stats.isDirectory()) {
        console.log(`📂 Scanning directory: ${absolutePath}`)
        const data = await discoverBehavioralTemplateMetadata(absolutePath)
        allMetadata.push(data)
      } else if (stats.isFile()) {
        console.log(`📄 Analyzing file: ${absolutePath}`)
        const data = await getBehavioralTemplateMetadata(absolutePath)
        allMetadata.push(data)
      } else {
        console.error(`🚩 Error: Path is neither file nor directory: ${absolutePath}`)
        process.exit(1)
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.error(`🚩 Error: Path does not exist: ${absolutePath}`)
      } else {
        console.error(`🚩 Error processing path ${absolutePath}:`, error)
      }
      process.exit(1)
    }
  }

  const metadata = allMetadata.flat()

  if (metadata.length === 0) {
    console.warn('\n⚠️  No BehavioralTemplate exports found in provided paths')
  }

  console.log(`✅ Discovered ${metadata.length} BehavioralTemplate exports`)

  return metadata
}
