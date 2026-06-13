#!/usr/bin/env bun

/**
 * Agent-facing CLI router for OnBraid skill discovery.
 *
 * @remarks
 * Agents discover skill capabilities via `onbraid skills`.
 *
 * @internal
 */

import {
  codeDocumentationCli,
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
  name: 'onbraid',
  description: 'Agent-facing skill discovery CLI for the OnBraid framework',
  commands: {
    ...markdownCli,
    ...mcpClientCli,
    ...codeDocumentationCli,
    ...gitContextCli,
    ...frontierAnalysisCli,
    ...evalCli,
    ...lspCli,
  },
})

await runCli(Bun.argv)
