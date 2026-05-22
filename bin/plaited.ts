#!/usr/bin/env bun

/**
 * Agent-facing CLI router for Plaited skill discovery.
 *
 * @remarks
 * Agents discover skill capabilities via `plaited skills`.
 *
 * @internal
 */

import {
  codeDocumentationCli,
  evalCli,
  frontierAnalysisCli,
  gitContextCli,
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
  },
})

await runCli(Bun.argv)
