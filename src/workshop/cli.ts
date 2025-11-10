#!/usr/bin/env bun
/**
 * @internal
 * @module cli
 *
 * Purpose: CLI entry point for Plaited workshop
 * Provides subcommands for running the workshop server and other utilities.
 * Supports Bun's --hot flag for automatic module hot reload.
 *
 * Usage:
 *   bun plaited server                              # Start server with default config
 *   bun plaited server -c custom.config.ts          # Start server with custom config
 *   bun --hot plaited server                        # Start server in hot mode
 *   bun --hot plaited server -c path/to/config.ts   # Custom config with hot reload
 */

import { getServer } from './get-server.js'
import { parseArgs } from 'node:util'
import { resolve } from 'node:path'
import { type PlaywrightTestConfig } from '@playwright/test'

console.log('🎭 Starting Plaited workshop...')

// Parse CLI arguments
const { values, positionals } = parseArgs({
  args: Bun.argv,
  options: {
    config: {
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
  console.log('Usage: plaited <command> [options]\n')
  console.log('Commands:')
  console.log('  server    Start the workshop server\n')
  console.log('Options:')
  console.log('  -c, --config <path>    Path to playwright config file (default: ./playwright.config.ts)\n')
  console.log('Examples:')
  console.log('  bun plaited server')
  console.log('  bun --hot plaited server')
  console.log('  bun plaited server -c custom.config.ts')
  process.exit(1)
}

if (subcommand !== 'server') {
  console.error(`❌ Error: Unknown subcommand '${subcommand}'\n`)
  console.log('Available commands:')
  console.log('  server    Start the workshop server')
  process.exit(1)
}

// Resolve config path (default to playwright.config.ts in cwd)
const configPath = values.config ?? './playwright.config.ts'
let absoluteConfigPath: string
try {
  absoluteConfigPath = Bun.resolveSync(configPath, process.cwd())
} catch (_) {
  throw new Error(
    `ERROR: Could not find config file: ${configPath}\n` +
      'Specify a valid path with -c or --config flag\n' +
      'Example: bun plaited server -c path/to/playwright.config.ts',
  )
}

// Load Playwright config dynamically
const configModule = await import(absoluteConfigPath)
const playwrightConfig = configModule.default as PlaywrightTestConfig

// Validate webServer configuration exists
if (!playwrightConfig.webServer) {
  throw new Error(
    `ERROR: webServer must be configured in ${configPath}\n` +
      'Example:\n' +
      '  webServer: {\n' +
      '    url: "http://localhost:3456",\n' +
      '    command: "bun --hot plaited server"\n' +
      '  }',
  )
}

// Ensure webServer is a single object, not an array
if (Array.isArray(playwrightConfig.webServer)) {
  throw new Error(
    `ERROR: Multiple webServers not supported in ${configPath}\n` +
      'Use a single webServer configuration\n' +
      'Example:\n' +
      '  webServer: {\n' +
      '    url: "http://localhost:3456",\n' +
      '    command: "bun --hot plaited server"\n' +
      '  }',
  )
}

// Now TypeScript knows webServer is a single TestConfigWebServer object
if (!playwrightConfig.webServer.url) {
  throw new Error(
    `ERROR: webServer.url must be configured in ${configPath}\n` +
      'Example:\n' +
      '  webServer: {\n' +
      '    url: "http://localhost:3456",\n' +
      '    command: "bun --hot plaited server"\n' +
      '  }',
  )
}

// Validate baseURL exists
if (!playwrightConfig.use?.baseURL) {
  throw new Error(
    `ERROR: use.baseURL must be configured in ${configPath}\n` +
      'Example:\n' +
      '  use: {\n' +
      '    baseURL: "http://localhost:3456"\n' +
      '  }',
  )
}

// webServer.url and baseURL must be identical
const webServerUrl = playwrightConfig.webServer.url
const baseURL = playwrightConfig.use.baseURL

if (webServerUrl !== baseURL) {
  throw new Error(
    `ERROR: webServer.url must match use.baseURL in ${configPath}\n` +
      `  webServer.url: ${webServerUrl}\n` +
      `  use.baseURL:   ${baseURL}\n` +
      'Both must be exactly the same',
  )
}

// Extract port from validated URL
const urlObj = new URL(webServerUrl)
const portString = urlObj.port

if (!portString) {
  throw new Error(`ERROR: URL must include explicit port: ${webServerUrl}\n` + 'Example: "http://localhost:3456"')
}

const port = parseInt(portString, 10)
if (isNaN(port) || port < 1 || port > 65535) {
  throw new Error(`ERROR: Invalid port number: ${port}. Must be between 1-65535`)
}

// Extract and validate testMatch pattern
const testMatch = playwrightConfig.testMatch
if (!testMatch) {
  throw new Error(
    `ERROR: testMatch must be configured in ${configPath}\n` + 'Example:\n' + '  testMatch: "**/*.tpl.spec.{ts,tsx}"',
  )
}

// Ensure testMatch is a string, not RegExp or array
if (typeof testMatch !== 'string') {
  throw new Error(
    `ERROR: testMatch must be a string pattern in ${configPath}\n` +
      'RegExp and array patterns are not supported\n' +
      'Example:\n' +
      '  testMatch: "**/*.tpl.spec.{ts,tsx}"',
  )
}

// Determine root directory from testDir (default to current directory)
const root = playwrightConfig.testDir ? resolve(process.cwd(), playwrightConfig.testDir) : process.cwd()

console.log(`📋 Configuration loaded from ${absoluteConfigPath}`)
console.log(`📂 Root: ${root}`)
console.log(`🌐 Port: ${port}`)
console.log(`🔍 Test Match: ${testMatch}`)

// Detect Bun --hot mode
// When running with --hot flag, Bun automatically reloads modules when files change
const isHotMode = process.execArgv.includes('--hot')

// Start server
const reloadClients = await getServer({
  cwd: root,
  port,
  testMatch,
})

console.log('📋 Ready to serve requests')

// Set up Bun hot reload integration
if (isHotMode) {
  console.log('🔥 Hot reload mode active')

  // Use Bun's module hot reload API to detect when files change
  if (import.meta.hot) {
    import.meta.hot.accept(() => {
      console.log('🔄 Module reloaded, notifying clients...')
      reloadClients()
    })
  }

  console.log('💡 Server will auto-reload when files change\n')
} else {
  console.log('💡 Run with "bun --hot plaited server" to enable hot reload\n')
}

// Keep process alive
process.stdin.resume()
