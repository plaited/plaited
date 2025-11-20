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
import { useSignal } from '../main.js'
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
  },
  strict: true,
  allowPositionals: true,
})

// Extract subcommand (skip bun executable and script path)
const subcommand = positionals[2]

// Validate subcommand
if (!subcommand) {
  console.error('❌ Error: Missing subcommand\n')
  console.log('Usage: plaited <command> [options] [paths...]\n')
  console.log('Commands:')
  console.log('  test      Run story tests\n')
  console.log('Options:')
  console.log('  -p, --port <number>    Port for test server (default: 0 - auto-assign)')
  console.log('  -d, --dir <path>       Working directory (default: process.cwd())\n')
  console.log('Examples:')
  console.log('  bun plaited test')
  console.log('  bun plaited test src/components')
  console.log('  bun plaited test src/Button.stories.tsx src/Card.stories.tsx')
  console.log('  bun plaited test -p 3500')
  console.log('  bun --hot plaited test')
  process.exit(1)
}

if (subcommand !== 'test') {
  console.error(`❌ Error: Unknown subcommand '${subcommand}'\n`)
  console.log('Available commands:')
  console.log('  test      Run story tests')
  process.exit(1)
}

// Parse and validate port (default to 0 for auto-assignment)
const port = values.port ? parseInt(values.port, 10) : 0
if (values.port && (Number.isNaN(port) || port < 0 || port > 65535)) {
  throw new Error(`ERROR: Invalid port number: ${values.port}. Must be between 0-65535`)
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

// Create reporter signal
const reporter = useSignal<TestStoriesOutput>()

const resultsPromise = new Promise<TestStoriesOutput>((resolve) => {
  reporter.listen('_', ({ detail }) => {
    resolve(detail)
  })
})

// Initialize test runner (this creates and starts the server)
console.log('🔧 Initializing test runner...')
const trigger = await useRunner({ browser, port, reporter, cwd })

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
if (metadata) {
  trigger({ type: 'run_tests', detail: metadata })
} else {
  trigger({ type: 'run_tests' })
}

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
