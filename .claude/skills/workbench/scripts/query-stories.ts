#!/usr/bin/env bun
/**
 * Discover and list all stories in specified paths
 *
 * Usage: bun query-stories.ts <paths...>
 */

import { parseArgs } from 'node:util'
import { collectStories } from 'plaited/workshop'

const { positionals } = parseArgs({
  args: Bun.argv.slice(2),
  allowPositionals: true,
})

if (positionals.length === 0) {
  console.error('Usage: bun query-stories.ts <paths...>')
  console.error('  paths: One or more directories or files to scan for stories')
  console.error('')
  console.error('Examples:')
  console.error('  bun query-stories.ts src/main')
  console.error('  bun query-stories.ts src/templates src/features')
  process.exit(1)
}

const cwd = process.cwd()

try {
  const storiesMap = await collectStories(cwd, positionals)

  // Convert Map to array of [route, metadata] entries
  const stories = [...storiesMap.values()]

  console.log(JSON.stringify(stories, null, 2))
} catch (error) {
  console.error(`Error: ${error}`)
  process.exit(1)
}
