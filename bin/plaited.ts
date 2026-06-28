#!/usr/bin/env bun

import {
  codeDocumentationCli,
  cssSchemasCli,
  evalCli,
  frontierAnalysisCli,
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
    ...frontierAnalysisCli,
    ...evalCli,
    ...lspCli,
    ...cssSchemasCli,
  },
})

await runCli(Bun.argv)
