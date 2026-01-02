#!/usr/bin/env bun
/**
 * Discover and list all BehavioralTemplate exports in specified paths
 *
 * Usage: bun query-templates.ts <paths...>
 */

import { parseArgs } from 'node:util'
import { collectBehavioralTemplates } from 'plaited/workshop'

const { positionals } = parseArgs({
  args: Bun.argv.slice(2),
  allowPositionals: true,
})

if (positionals.length === 0) {
  console.error('Usage: bun query-templates.ts <paths...>')
  console.error('  paths: One or more directories or files to scan for bElements')
  console.error('')
  console.error('Examples:')
  console.error('  bun query-templates.ts src/main')
  console.error('  bun query-templates.ts src/components src/features')
  process.exit(1)
}

const cwd = process.cwd()

try {
  const templates = await collectBehavioralTemplates(cwd, positionals)

  console.log(JSON.stringify(templates, null, 2))
} catch (error) {
  console.error(`Error: ${error}`)
  process.exit(1)
}
