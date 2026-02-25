import { join } from 'node:path'

/**
 * Check if a path has a source file extension
 */
const hasSourceExtension = (path: string): boolean => /\.(tsx?|jsx?|mjs|cjs|json)$/.test(path)

/**
 * Resolve a file path to an absolute path
 *
 * @remarks
 * Resolution order:
 * 1. Absolute paths (starting with `/`) - returned as-is
 * 2. Explicit relative with extension (`./foo.ts`, `../bar.ts`) - resolved from cwd
 * 3. Everything else - try Bun.resolveSync(), fallback to cwd
 *
 * The "everything else" category includes:
 * - Package specifiers: `@org/pkg`, `lodash`, `typescript/lib/typescript.js`
 * - Relative without extension: `./testing` (for package.json exports)
 * - Implicit relative: `src/foo.ts` (fails Bun.resolveSync, falls back to cwd)
 */
export const resolveFilePath = (filePath: string): string => {
  const cwd = process.cwd()

  // Absolute path - return as-is
  if (filePath.startsWith('/')) {
    return filePath
  }

  // Explicit relative with extension - resolve directly from cwd
  if (filePath.startsWith('.') && hasSourceExtension(filePath)) {
    return join(cwd, filePath)
  }

  // Everything else: try Bun.resolveSync
  // Handles packages, exports field resolution, and implicit relative paths (via fallback)
  try {
    return Bun.resolveSync(filePath, cwd)
  } catch {
    return join(cwd, filePath)
  }
}
