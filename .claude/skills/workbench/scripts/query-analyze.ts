#!/usr/bin/env bun
/**
 * Batch analysis script for discovering stories and templates
 *
 * Usage: bun query-analyze.ts <paths...> [options]
 *
 * Options:
 *   --stories, -s     Find all stories
 *   --templates, -t   Find all bElements
 *   --urls, -u        Generate URLs for discovered stories
 *   --all             Run all analyses
 *   --port <port>     Dev server port for URLs (default: 3000)
 */

import { parseArgs } from 'node:util'
import { collectBehavioralTemplates, collectStories, getStoryUrl } from 'plaited/workshop'

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    stories: { type: 'boolean', short: 's' },
    templates: { type: 'boolean', short: 't' },
    urls: { type: 'boolean', short: 'u' },
    all: { type: 'boolean' },
    port: { type: 'string', short: 'p', default: '3000' },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: true,
})

if (values.help || positionals.length === 0) {
  console.log(`
Query Analyze - Batch analysis for stories and templates

Usage: bun query-analyze.ts <paths...> [options]

Options:
  --stories, -s     Find all stories
  --templates, -t   Find all bElements
  --urls, -u        Generate URLs for discovered stories
  --all             Run all analyses (stories + templates + urls)
  --port, -p        Dev server port for URLs (default: 3000)
  --help, -h        Show this help

Examples:
  bun query-analyze.ts src/main --all
  bun query-analyze.ts src/main --stories
  bun query-analyze.ts src/templates --templates
  bun query-analyze.ts src/main --stories --urls --port 3500
`)
  process.exit(0)
}

const cwd = process.cwd()
const port = parseInt(values.port ?? '3000', 10)

type AnalysisResult = {
  paths: string[]
  stories?: Array<{
    route: string
    exportName: string
    filePath: string
    hasPlay: boolean
    flag?: 'only' | 'skip'
  }>
  templates?: Array<{
    exportName: string
    filePath: string
    type: string
  }>
  urls?: Array<{
    exportName: string
    url: string
  }>
}

try {
  const result: AnalysisResult = { paths: positionals }

  // Collect stories if requested
  if (values.stories || values.urls || values.all) {
    const storiesMap = await collectStories(cwd, positionals)
    result.stories = [...storiesMap.entries()].map(([route, metadata]) => ({
      route,
      exportName: metadata.exportName,
      filePath: metadata.filePath,
      hasPlay: metadata.hasPlay,
      flag: metadata.flag,
    }))

    // Generate URLs if requested
    if (values.urls || values.all) {
      result.urls = [...storiesMap.values()].map((story) => ({
        exportName: story.exportName,
        url: getStoryUrl({
          cwd,
          filePath: story.filePath,
          exportName: story.exportName,
          port,
        }),
      }))
    }
  }

  // Collect templates if requested
  if (values.templates || values.all) {
    result.templates = await collectBehavioralTemplates(cwd, positionals)
  }

  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  console.error(`Error: ${error}`)
  process.exit(1)
}
