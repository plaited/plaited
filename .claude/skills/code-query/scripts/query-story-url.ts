#!/usr/bin/env bun
/**
 * Generate preview URLs for a story
 *
 * Usage: bun query-story-url.ts <file> <exportName> [--port <port>]
 *
 * @example
 * bun query-story-url.ts src/button.stories.tsx PrimaryButton
 * bun query-story-url.ts src/button.stories.tsx PrimaryButton --port 3500
 */

import { parseArgs } from 'node:util'
import { getStoryUrl } from 'plaited/workshop'

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    port: {
      type: 'string',
      short: 'p',
      default: '3000',
    },
  },
  allowPositionals: true,
})

const [filePath, exportName] = positionals

if (!filePath || !exportName) {
  console.error('Usage: bun query-story-url.ts <file> <exportName> [--port <port>]')
  console.error('  file: Path to story file')
  console.error('  exportName: Name of the story export')
  console.error('  --port, -p: Dev server port (default: 3000)')
  console.error('')
  console.error('Examples:')
  console.error('  bun query-story-url.ts src/button.stories.tsx PrimaryButton')
  console.error('  bun query-story-url.ts src/button.stories.tsx PrimaryButton --port 3500')
  process.exit(1)
}

const cwd = process.cwd()
const absolutePath = filePath.startsWith('/') ? filePath : `${cwd}/${filePath}`
const port = parseInt(values.port ?? '3000', 10)

try {
  const result = getStoryUrl({
    cwd,
    filePath: absolutePath,
    exportName,
    port,
  })

  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  console.error(`Error: ${error}`)
  process.exit(1)
}
