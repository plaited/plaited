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

import {
  BEHAVIORAL_FRONTIER_COMMAND,
  behavioralFrontierCli,
  EVAL_COMMAND,
  evalCli,
  SKILLS_COMMAND,
  skillsCli,
  TYPESCRIPT_LSP_COMMAND,
  typescriptLspCli,
  VLLM_COMMAND,
  vllmCli,
} from '../src/cli.ts'

// ============================================================================
// Command Registry
// ============================================================================

const COMMANDS: Record<string, (args: string[]) => Promise<void>> = {
  [VLLM_COMMAND]: vllmCli,
  [BEHAVIORAL_FRONTIER_COMMAND]: behavioralFrontierCli,
  [EVAL_COMMAND]: evalCli,
  [SKILLS_COMMAND]: skillsCli,
  [TYPESCRIPT_LSP_COMMAND]: typescriptLspCli,
}

// ============================================================================
// Top-level --schema: Command manifest
// ============================================================================

const printCommandManifest = () => {
  const commandNames = Object.keys(COMMANDS).sort()
  const manifest = {
    name: 'plaited',
    description: 'Agent-facing CLI toolbox for the Plaited framework',
    commands: commandNames,
    usage: "plaited <command> '<json>' | --schema input",
    discovery: 'plaited --schema',
  }
  console.log(JSON.stringify(manifest, null, 2))
}

// ============================================================================
// Router
// ============================================================================

export const runCli = async (argv: string[]): Promise<void> => {
  const command = argv[2]
  const args = argv.slice(3)
  const commandNames = Object.keys(COMMANDS).sort()

  if (!command || command === '--help' || command === '-h') {
    console.error(`Usage: plaited <command> [options]
       plaited <command> --schema     # Discover input schema
       plaited <command> '<json>'    # Structured JSON input
       plaited --schema               # List all commands

Commands:
    ${commandNames.join(', ')}`)
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

  await handler(args).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}

await runCli(Bun.argv)
