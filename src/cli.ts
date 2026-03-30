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
import { bashCli, editFileCli, listFilesCli, readFileCli, writeFileCli } from './agent/crud.ts'
import { discoverSkillsCli, evaluateSkillCli, ingestSkillCli, skillLinksCli, validateSkillCli } from './skill.ts'
import { validateResearchCli } from './tools/research-validate.ts'
import { typescriptLsp } from './tools/typescript-lsp.ts'

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
  // Development tools
  'validate-skill': validateSkillCli,
  'validate-research': validateResearchCli,
  'ingest-skill': ingestSkillCli,
  'discover-skills': discoverSkillsCli,
  'evaluate-skill': evaluateSkillCli,
  'skill-links': skillLinksCli,
  'typescript-lsp': typescriptLsp,
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

  Development:
    validate-skill, ingest-skill, discover-skills,
    evaluate-skill, skill-links,
    validate-research, typescript-lsp`)
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
