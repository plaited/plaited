#!/usr/bin/env bun
/**
 * Get route and entry path for a story export
 *
 * Usage: bun query-paths.ts <file> <exportName>
 */

import { parseArgs } from 'node:util'
import { getPaths } from 'plaited/workshop'

const { positionals } = parseArgs({
  args: Bun.argv.slice(2),
  allowPositionals: true,
})

const [filePath, exportName] = positionals

if (!filePath || !exportName) {
  console.error('Usage: bun query-paths.ts <file> <exportName>')
  console.error('  file: Path to story file')
  console.error('  exportName: Name of the story export')
  console.error('')
  console.error('Examples:')
  console.error('  bun query-paths.ts src/button.stories.tsx PrimaryButton')
  process.exit(1)
}

const cwd = process.cwd()
const absolutePath = filePath.startsWith('/') ? filePath : `${cwd}/${filePath}`

try {
  const result = getPaths({
    cwd,
    filePath: absolutePath,
    exportName,
  })

  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  console.error(`Error: ${error}`)
  process.exit(1)
}
