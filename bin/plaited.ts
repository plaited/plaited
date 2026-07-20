#!/usr/bin/env bun

import {
  codeDocumentationCli,
  evalCli,
  gitContextCli,
  lspCli,
  makeCliRouter,
  markdownCli,
  mcpClientCli,
} from '../src/cli.ts'

// ============================================================================
// Command Registry
// ============================================================================

export const runCli = makeCliRouter({
  name: 'plaited',
  description: 'Agent-facing skill discovery CLI for the Plaited framework',
  commands: {
    ...markdownCli,
    ...mcpClientCli,
    ...codeDocumentationCli,
    ...gitContextCli,
    ...evalCli,
    ...lspCli,
  },
})

await runCli(Bun.argv)
