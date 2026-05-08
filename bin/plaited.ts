#!/usr/bin/env bun

/**
 * Agent-facing CLI router for Plaited skill discovery.
 *
 * @remarks
 * Agents discover skill capabilities via `plaited skills`.
 *
 * @internal
 */

import { makeCliRouter, SKILLS_COMMAND, skillsCli } from '../src/cli.ts'

// ============================================================================
// Command Registry
// ============================================================================

export const runCli = makeCliRouter({
  name: 'plaited',
  description: 'Agent-facing skill discovery CLI for the Plaited framework',
  commands: {
    [SKILLS_COMMAND]: skillsCli,
  },
})

await runCli(Bun.argv)
