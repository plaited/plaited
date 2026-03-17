#!/usr/bin/env bun

/**
 * Agent-facing CLI router for the Plaited toolbox.
 *
 * @remarks
 * Agents discover capabilities via `plaited --schema` and invoke
 * commands via `plaited <command> --json '{...}'`. Each command
 * follows the tool genome: configSchema + runner + CLI handler.
 *
 * @internal
 */

// Agent tools (CRUD)
import { bashCli, editFileCli, listFilesCli, readFileCli, writeFileCli } from './tools/crud.ts'
import { ingestGoalCli } from './tools/ingest-goal.ts'
import { ingestRulesCli } from './tools/ingest-rules.ts'
import { ingestSkillCli } from './tools/ingest-skill.ts'
import { discoverSkillsCli } from './tools/skill-discovery.ts'
import { validateSkill } from './tools/skill-validate.ts'
// Trial runner
import { trialCli } from './improve/trial.ts'
import { typescriptLsp } from './tools/typescript-lsp.ts'
import { validateThreadCli } from './tools/validate-thread.ts'

// ============================================================================
// Command Registry
// ============================================================================

const COMMANDS: Record<string, (args: string[]) => Promise<void>> = {
  // Agent tools (CRUD)
  'read-file': readFileCli,
  'write-file': writeFileCli,
  'edit-file': editFileCli,
  'list-files': listFilesCli,
  bash: bashCli,
  // Trial runner
  trial: trialCli,
  // Development tools
  'validate-skill': validateSkill,
  'validate-thread': validateThreadCli,
  'ingest-goal': ingestGoalCli,
  'ingest-skill': ingestSkillCli,
  'ingest-rules': ingestRulesCli,
  'discover-skills': discoverSkillsCli,
  'typescript-lsp': typescriptLsp,
  // ACP adapter (long-lived stdio process)
  acp: async () => {
    await import('./acp.ts')
  },
}

// ============================================================================
// Top-level --schema: Command manifest
// ============================================================================

const printCommandManifest = () => {
  const manifest = {
    name: 'plaited',
    description: 'Agent-facing CLI toolbox for the Plaited framework',
    commands: Object.keys(COMMANDS).sort(),
    usage: "plaited <command> '<json>' | --schema input",
    discovery: 'plaited --schema',
  }
  console.log(JSON.stringify(manifest, null, 2))
}

// ============================================================================
// Router
// ============================================================================

const command = Bun.argv[2]
const args = Bun.argv.slice(3)

if (!command || command === '--help' || command === '-h') {
  console.error(`Usage: plaited <command> [options]
       plaited <command> --schema     # Discover input schema
       plaited <command> '<json>'    # Structured JSON input
       plaited --schema               # List all commands

Commands:
  Agent Tools:
    read-file, write-file, edit-file, list-files, bash

  Trial Runner:
    trial

  Development:
    validate-skill, validate-thread, ingest-goal,
    ingest-skill, ingest-rules, discover-skills,
    typescript-lsp

  ACP (Internal Control Surface):
    acp [--node <name>]`)
  process.exit(command ? 0 : 1)
}

if (command === '--schema') {
  printCommandManifest()
  process.exit(0)
}

const handler = COMMANDS[command]
if (!handler) {
  console.error(`Unknown command: ${command}`)
  console.error(`Run 'plaited --help' to see available commands`)
  process.exit(1)
}

handler(args).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
