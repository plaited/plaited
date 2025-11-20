#!/usr/bin/env bun

/**
 * @internal
 * @module cli
 *
 * Purpose: CLI entry point for Plaited workshop test runner
 * Provides test command for running story tests with Playwright.
 * Supports Bun's --hot flag for automatic module hot reload.
 *
 * Usage:
 *   bun plaited test                                    # Run all stories in cwd
 *   bun plaited test src/components                     # Run stories from directory
 *   bun plaited test src/Button.stories.tsx             # Run stories from file
 *   bun plaited test -p 3500                            # Custom port
 *   bun plaited test -d ./my-project                    # Custom working directory
 *   bun --hot plaited test                              # Enable hot reload
 */

import { statSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { checkPlaywright } from './check-playwright.js'
import { discoverStoryMetadata, getStoryMetadata } from './collect-stories.js'
import { type TestStoriesOutput, useRunner } from './use-runner.js'
import type { StoryMetadata } from './workshop.types.js'

console.log('🎭 Starting Plaited workshop test runner...')

// Verify Bun runtime
if (typeof Bun === 'undefined') {
  console.error('❌ Error: Plaited CLI requires Bun runtime')
  console.error('   Install Bun: https://bun.sh')
  console.error('   Then run: bun plaited test')
  process.exit(1)
}

// Parse CLI arguments
const { values, positionals } = parseArgs({
  args: Bun.argv,
  options: {
    port: {
      type: 'string',
      short: 'p',
    },
    dir: {
      type: 'string',
      short: 'd',
    },
    'color-scheme': {
      type: 'string',
      short: 'c',
    },
  },
  strict: true,
  allowPositionals: true,
})

// Extract subcommand (skip bun executable and script path)
const subcommand = positionals[2]

// Validate subcommand
if (!subcommand) {
  console.error('❌ Error: Missing subcommand\n')
  console.log('Usage: plaited <command> [options] [args...]\n')
  console.log('Commands:')
  console.log('  test      Run story tests')
  console.log('  query     Query documentation database')
  console.log('  changelog Generate release changelog\n')
  console.log('Options:')
  console.log('  -p, --port <number>       Port for test server (default: 0 - auto-assign)')
  console.log('  -d, --dir <path>          Working directory (default: process.cwd())')
  console.log('  -c, --color-scheme <mode> Color scheme for browser (light|dark, default: light)\n')
  console.log('Examples:')
  console.log('  bun plaited test')
  console.log('  bun plaited test src/components')
  console.log('  bun plaited query --help')
  console.log('  bun plaited changelog --version 7.3.0')
  process.exit(1)
}

const validCommands = ['test', 'query', 'changelog']
if (!validCommands.includes(subcommand)) {
  console.error(`❌ Error: Unknown subcommand '${subcommand}'\n`)
  console.log('Available commands:')
  console.log('  test      Run story tests')
  console.log('  query     Query documentation database')
  console.log('  changelog Generate release changelog')
  process.exit(1)
}

// Handle query command
if (subcommand === 'query') {
  const { parseArgs: parseQueryArgs } = await import('node:util')
  const queryArgs = parseQueryArgs({
    args: Bun.argv.slice(3),
    options: {
      action: { type: 'string' },
      file: { type: 'string' },
      query: { type: 'string' },
      export: { type: 'string' },
      name: { type: 'string' },
      limit: { type: 'string' },
      module: { type: 'string' },
      category: { type: 'string' },
      complexity: { type: 'string' },
      help: { type: 'boolean' },
    },
    allowPositionals: true,
  })

  if (queryArgs.values.help) {
    console.log('Usage: plaited query --action <action> [options]\n')
    console.log('Actions:')
    console.log('  insert-example       Insert a new example (requires --file or stdin JSON)')
    console.log('  insert-pattern       Insert a new pattern (requires --file or stdin JSON)')
    console.log('  search-examples      Search examples (requires --query)')
    console.log('  search-patterns      Search patterns (requires --query)')
    console.log('  get-examples         Get examples by export (requires --export)')
    console.log('  get-pattern          Get pattern by name (requires --name)')
    console.log('  list-examples        List all examples (optional filters)')
    console.log('  list-patterns        List all patterns (optional filters)\n')
    console.log('Options:')
    console.log('  --file <path>        JSON file path')
    console.log('  --query <text>       Search query')
    console.log('  --export <name>      Export name')
    console.log('  --name <name>        Pattern name')
    console.log('  --limit <number>     Result limit (default: 10)')
    console.log('  --module <name>      Filter by module')
    console.log('  --category <name>    Filter by category')
    console.log('  --complexity <level> Filter by complexity (basic|intermediate|advanced)')
    process.exit(0)
  }

  const action = queryArgs.values.action
  if (!action) {
    console.error('❌ Error: --action required\n')
    console.log('Run: plaited query --help')
    process.exit(1)
  }

  const queries = await import('./queries.js')

  try {
    if (action === 'insert-example') {
      const input = queryArgs.values.file
        ? await Bun.file(queryArgs.values.file).json()
        : JSON.parse(await new Response(Bun.stdin).text())
      const id = queries.insertExample(input)
      console.log(JSON.stringify({ id, success: true }))
    } else if (action === 'insert-pattern') {
      const input = queryArgs.values.file
        ? await Bun.file(queryArgs.values.file).json()
        : JSON.parse(await new Response(Bun.stdin).text())
      const id = queries.insertPattern(input)
      console.log(JSON.stringify({ id, success: true }))
    } else if (action === 'search-examples') {
      if (!queryArgs.values.query) {
        console.error('❌ Error: --query required for search-examples')
        process.exit(1)
      }
      const limit = queryArgs.values.limit ? parseInt(queryArgs.values.limit, 10) : 10
      const results = queries.searchExamples(queryArgs.values.query, limit)
      console.log(JSON.stringify(results, null, 2))
    } else if (action === 'search-patterns') {
      if (!queryArgs.values.query) {
        console.error('❌ Error: --query required for search-patterns')
        process.exit(1)
      }
      const limit = queryArgs.values.limit ? parseInt(queryArgs.values.limit, 10) : 10
      const results = queries.searchPatterns(queryArgs.values.query, limit)
      console.log(JSON.stringify(results, null, 2))
    } else if (action === 'get-examples') {
      if (!queryArgs.values.export) {
        console.error('❌ Error: --export required for get-examples')
        process.exit(1)
      }
      const results = queries.getExamplesByExport(queryArgs.values.export)
      console.log(JSON.stringify(results, null, 2))
    } else if (action === 'get-pattern') {
      if (!queryArgs.values.name) {
        console.error('❌ Error: --name required for get-pattern')
        process.exit(1)
      }
      const result = queries.getPattern(queryArgs.values.name)
      console.log(JSON.stringify(result, null, 2))
    } else if (action === 'list-examples') {
      const options: {
        module?: 'main' | 'testing' | 'utils' | 'workshop'
        category?: string
        complexity?: 'basic' | 'intermediate' | 'advanced'
      } = {}
      if (queryArgs.values.module) options.module = queryArgs.values.module as 'main' | 'testing' | 'utils' | 'workshop'
      if (queryArgs.values.category) options.category = queryArgs.values.category
      if (queryArgs.values.complexity)
        options.complexity = queryArgs.values.complexity as 'basic' | 'intermediate' | 'advanced'
      const results = queries.listExamples(options)
      console.log(JSON.stringify(results, null, 2))
    } else if (action === 'list-patterns') {
      const options: {
        category?: string
        complexity?: 'basic' | 'intermediate' | 'advanced'
      } = {}
      if (queryArgs.values.category) options.category = queryArgs.values.category
      if (queryArgs.values.complexity)
        options.complexity = queryArgs.values.complexity as 'basic' | 'intermediate' | 'advanced'
      const results = queries.listPatterns(options)
      console.log(JSON.stringify(results, null, 2))
    } else {
      console.error(`❌ Error: Unknown action '${action}'`)
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }

  process.exit(0)
}

// Handle changelog command
if (subcommand === 'changelog') {
  const { parseArgs: parseChangelogArgs } = await import('node:util')
  const changelogArgs = parseChangelogArgs({
    args: Bun.argv.slice(3),
    options: {
      version: { type: 'string' },
      action: { type: 'string' },
      output: { type: 'string' },
      help: { type: 'boolean' },
    },
    allowPositionals: true,
  })

  if (changelogArgs.values.help) {
    console.log('Usage: plaited changelog [options]\n')
    console.log('Options:')
    console.log('  --version <version>  Release version (default: current package.json version)')
    console.log('  --action <action>    Action to perform (generate|list-versions|clear)')
    console.log('  --output <path>      Write output to file instead of stdout\n')
    console.log('Actions:')
    console.log('  generate         Generate markdown changelog (default)')
    console.log('  list-versions    List all versions with changes')
    console.log('  clear            Clear changes for a version (destructive!)\n')
    console.log('Examples:')
    console.log('  plaited changelog --version 7.3.0')
    console.log('  plaited changelog --action list-versions')
    console.log('  plaited changelog --version 7.3.0 --output CHANGELOG.md')
    process.exit(0)
  }

  const packageJson = await import('../../package.json', { with: { type: 'json' } })
  const version = changelogArgs.values.version || packageJson.default.version
  const action = changelogArgs.values.action || 'generate'

  const changelog = await import('./changelog.js')

  try {
    if (action === 'generate') {
      const changes = changelog.generateChangelog(version)
      const markdown = changelog.formatChangelog(version, changes)

      if (changelogArgs.values.output) {
        await Bun.write(changelogArgs.values.output, markdown)
        console.log(`✅ Changelog written to ${changelogArgs.values.output}`)
      } else {
        console.log(markdown)
      }
    } else if (action === 'list-versions') {
      const versions = changelog.getVersionsWithChanges()
      console.log(JSON.stringify(versions, null, 2))
    } else if (action === 'clear') {
      const count = changelog.clearChanges(version)
      console.log(`✅ Cleared ${count} changes for version ${version}`)
    } else {
      console.error(`❌ Error: Unknown action '${action}'`)
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }

  process.exit(0)
}

// Parse and validate port (default to 0 for auto-assignment)
const port = values.port ? parseInt(values.port, 10) : 0
if (values.port && (Number.isNaN(port) || port < 0 || port > 65535)) {
  throw new Error(`ERROR: Invalid port number: ${values.port}. Must be between 0-65535`)
}

// Parse and validate color scheme (default to 'light')
const colorScheme = (values['color-scheme'] as 'light' | 'dark' | undefined) ?? 'light'
if (values['color-scheme'] && colorScheme !== 'light' && colorScheme !== 'dark') {
  console.error(`❌ Error: Invalid color-scheme '${values['color-scheme']}'\n`)
  console.log('Valid values: light, dark')
  process.exit(1)
}

// Determine working directory
const cwd = values.dir ? resolve(process.cwd(), values.dir) : process.cwd()

// Check for Playwright installation before proceeding
console.log('🔍 Checking Playwright installation...')
const playwrightReady = await checkPlaywright(cwd)

if (!playwrightReady) {
  console.error('\n❌ Cannot run tests without Playwright')
  process.exit(1)
}

console.log('✅ Playwright is ready\n')

// Extract paths from positionals (skip bun, script path, and subcommand)
const paths = positionals.slice(3)

console.log(`📋 Configuration:`)
console.log(`   Working directory: ${cwd}`)
console.log(`   Port: ${port === 0 ? '0 (auto-assign)' : port}`)
if (paths.length > 0) {
  console.log(`   Paths: ${paths.join(', ')}`)
}

// Discover stories based on provided paths
let metadata: StoryMetadata[] | undefined

if (paths.length > 0) {
  console.log('\n🔍 Discovering stories from provided paths...')
  const allMetadata: StoryMetadata[] = []

  for (const pathArg of paths) {
    const absolutePath = resolve(cwd, pathArg)

    try {
      const stats = statSync(absolutePath)

      if (stats.isDirectory()) {
        console.log(`📂 Scanning directory: ${absolutePath}`)
        const dirMetadata = await discoverStoryMetadata(absolutePath)
        allMetadata.push(...dirMetadata)
      } else if (stats.isFile()) {
        console.log(`📄 Analyzing file: ${absolutePath}`)
        const fileMetadata = await getStoryMetadata(absolutePath)
        allMetadata.push(...fileMetadata)
      } else {
        console.error(`❌ Error: Path is neither file nor directory: ${absolutePath}`)
        process.exit(1)
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.error(`❌ Error: Path does not exist: ${absolutePath}`)
      } else {
        console.error(`❌ Error processing path ${absolutePath}:`, error)
      }
      process.exit(1)
    }
  }

  if (allMetadata.length === 0) {
    console.warn('\n⚠️  No story exports found in provided paths')
    process.exit(0)
  }

  metadata = allMetadata
  console.log(`✅ Discovered ${metadata.length} story exports from ${paths.length} path(s)\n`)
} else {
  console.log('\n🔍 No paths provided - will discover all stories in working directory\n')
}

// Launch browser
console.log('🌐 Launching browser...')
const { chromium } = await import('playwright')
const browser = await chromium.launch()

// Create results promise with resolver
const { promise: resultsPromise, resolve: reportResults } = Promise.withResolvers<TestStoriesOutput>()

// Initialize test runner (this creates and starts the server)
console.log('🔧 Initializing test runner...')
const trigger = await useRunner({ browser, port, reporter: reportResults, cwd })

// Cleanup handler
const cleanup = async () => {
  console.log('\n🧹 Cleaning up...')
  trigger({ type: 'end' })
  await browser.close()
}

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', async () => {
  console.log('\n⚠️  Interrupted by user')
  await cleanup()
  process.exit(130) // Standard exit code for SIGINT
})

// Detect Bun --hot mode
const isHotMode = process.execArgv.includes('--hot')

// Set up Bun hot reload integration
if (isHotMode) {
  console.log('🔥 Hot reload mode active')

  if (import.meta.hot) {
    import.meta.hot.accept(() => {
      console.log('\n🔄 Module reloaded, notifying clients...')
      trigger({ type: 'reload' })
    })
  }

  console.log('💡 Server will auto-reload when files change\n')
} else {
  console.log('💡 Run with "bun --hot plaited test" to enable hot reload\n')
}

// Run tests
console.log('🚀 Running tests...\n')
trigger({
  type: 'run_tests',
  detail: {
    metadata,
    colorScheme,
  },
})

// Wait for results
const results = await resultsPromise

// Print summary
console.log(`\n${'='.repeat(50)}`)
console.log('📊 Test Summary')
console.log('='.repeat(50))
console.log(`Total:  ${results.total}`)
console.log(`Passed: ${results.passed} ✅`)
console.log(`Failed: ${results.failed} ❌`)
console.log('='.repeat(50))

// Cleanup and exit
await cleanup()

// Exit with appropriate code
if (results.failed > 0) {
  console.log('\n❌ Tests failed')
  process.exit(1)
} else {
  console.log('\n✅ All tests passed')
  process.exit(0)
}
