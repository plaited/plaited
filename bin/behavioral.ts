#!/usr/bin/env bun

// ============================================================================
// Command Registry
// ============================================================================

import { makeCliRouter } from '../src/cli/cli.ts'
import { gitContextCli } from '../src/cli/git-context.ts'
import { markdownCli } from '../src/cli/markdown.ts'
import { mcpClientCli } from '../src/cli/mcp-client.ts'
import { turnCli } from '../src/cli/turn.ts'
import { lspCli } from '../src/cli/typescript-lsp.ts'

export const runCli = makeCliRouter({
  name: 'behavioral',
  description: 'Agent-facing skill discovery CLI for the behavioral agent harness',
  commands: {
    ...markdownCli,
    ...mcpClientCli,
    ...gitContextCli,
    ...lspCli,
    ...turnCli,
  },
})

await runCli(Bun.argv)
