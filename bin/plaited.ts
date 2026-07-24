#!/usr/bin/env bun

// ============================================================================
// Command Registry
// ============================================================================

import { codeDocumentationCli } from '../src/cli/code-documentation.ts'
import { gitContextCli } from '../src/cli/git-context.ts'
import { markdownCli } from '../src/cli/markdown.ts'
import { mcpClientCli } from '../src/cli/mcp-client.ts'
import { lspCli } from '../src/cli/typescript-lsp.ts'
import { makeCliRouter } from '../src/cli.ts'

export const runCli = makeCliRouter({
  name: 'plaited',
  description: 'Agent-facing skill discovery CLI for the Plaited framework',
  commands: {
    ...markdownCli,
    ...mcpClientCli,
    ...codeDocumentationCli,
    ...gitContextCli,
    ...lspCli,
  },
})

await runCli(Bun.argv)
