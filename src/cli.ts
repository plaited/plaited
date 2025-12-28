#!/usr/bin/env bun

/**
 * @internal
 * @module cli
 *
 * CLI entry point for Plaited workshop test runner.
 * Provides test and dev commands with Playwright integration.
 *
 * @remarks
 * Supports Bun's --hot flag for automatic module hot reload.
 *

 *   bun plaited test -d ./my-project                    # Custom working directory
 *   bun --hot plaited test                              # Enable hot reload
 */

import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { useDevCommand } from './workshop/use-dev-command.ts'
import { useTestCommand } from './workshop/use-test-command.ts'

console.log('🎭 Starting Plaited workshop')

// Verify Bun runtime
if (typeof Bun === 'undefined') {
  console.error('🚩 Error: Plaited CLI requires Bun runtime')
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
    'color-scheme': {
      type: 'string',
      short: 'c',
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
  console.error('🚩 Error: Missing subcommand\n')
  console.log('Usage: plaited <command> [options] [args...]\n')
  console.log('Commands:')
  console.log('  test      Run story tests')
  console.log('  dev       Start development server with hot reload')
  console.log('Options:')
  console.log('  -p, --port <number>       Port for test server (default: 0 - auto-assign)')
  console.log('  -d, --dir <path>          Working directory (default: process.cwd())')
  console.log('  -c, --color-scheme <mode> Color scheme for test browser (light|dark, default: light)\n')
}

if (!['test', 'dev'].includes(subcommand ?? '')) {
  console.error(`🚩 Error: Unknown subcommand '${subcommand}'\n`)
  console.log('Available commands:')
  console.log('  test      Run story tests')
  console.log('  dev       Start development server with hot reload')
  process.exit(1)
}

const hasValidColorScheme = (colorScheme?: string): colorScheme is 'light' | 'dark' | undefined => {
  if (colorScheme === undefined) return true
  return colorScheme === 'light' || colorScheme === 'dark'
}

if (!hasValidColorScheme(values['color-scheme'])) {
  console.error(`🚩 Error: Invalid color-scheme '${values['color-scheme']}'\n`)
  console.log('Valid values: light, dark')
  process.exit(1)
}
// Parse dev-specific args (port, dir, color-scheme)
const port = values.port ? parseInt(values.port, 10) : undefined

if (port && (Number.isNaN(port) || port < 0 || port > 65535)) {
  throw new Error(`ERROR: Invalid port number: ${values.port}. Must be between 0-65535`)
}

const { 'color-scheme': colorScheme } = values

// Get paths from positionals
let paths = positionals.slice(3)
//Get Common Root Folder

if (paths.length === 0) {
  console.log('\n🔍 No paths provided - will discover all stories in working directory\n')
  paths = [process.cwd()]
}

const cwd = values.dir ? resolve(process.cwd(), values.dir) : process.cwd()

// Handle dev command
if (subcommand === 'dev') useDevCommand({ port, cwd, colorScheme, paths })
if (subcommand === 'test') useTestCommand({ port, cwd, colorScheme, paths })
