#!/usr/bin/env bun
/**
 * TypeScript LSP MCP Server CLI
 *
 * @remarks
 * Command-line interface for running the TypeScript LSP MCP server.
 * Uses stdio transport for MCP communication.
 *
 * Usage:
 *   bun src/workshop/lsp-mcp-cli.ts [--root <path>] [--command <cmd>...]
 *
 * Options:
 *   --root, -r     Root directory for the LSP server (default: cwd)
 *   --command, -c  Custom command to spawn (default: bun typescript-language-server --stdio)
 *
 * @internal
 */

import { parseArgs } from 'node:util'
import { runLspMcpServer } from './lsp-mcp-server.ts'

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    root: {
      type: 'string',
      short: 'r',
      default: process.cwd(),
    },
    command: {
      type: 'string',
      short: 'c',
      multiple: true,
    },
    help: {
      type: 'boolean',
      short: 'h',
    },
  },
  allowPositionals: true,
})

if (values.help) {
  console.log(`
TypeScript LSP MCP Server

Usage:
  bun src/workshop/lsp-mcp-cli.ts [options]

Options:
  --root, -r <path>      Root directory for the LSP server (default: current directory)
  --command, -c <cmd>    Custom command parts (can be repeated).
                         Default: bun typescript-language-server --stdio
  --help, -h             Show this help message

Examples:
  # Use default settings
  bun src/workshop/lsp-mcp-cli.ts

  # Specify root directory
  bun src/workshop/lsp-mcp-cli.ts --root /path/to/project

  # Use custom command
  bun src/workshop/lsp-mcp-cli.ts -c npx -c typescript-language-server -c --stdio

MCP Configuration (.mcp.json):
  {
    "mcpServers": {
      "typescript-lsp": {
        "command": "bun",
        "args": ["src/workshop/lsp-mcp-cli.ts", "--root", "."]
      }
    }
  }
`)
  process.exit(0)
}

const rootUri = `file://${values.root}`
const command = values.command?.length ? values.command : positionals.length ? positionals : undefined

await runLspMcpServer(rootUri, command)
