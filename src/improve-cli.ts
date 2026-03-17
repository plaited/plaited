#!/usr/bin/env bun

/**
 * Improvement-facing CLI router for eval, distillation, and training flows.
 *
 * @remarks
 * Keeps calibration infrastructure separate from the main runtime CLI while
 * preserving structured command discovery for local research workflows.
 *
 * @internal
 */

import { trainingScoreCli, trialCli } from './improve.ts'

const COMMANDS: Record<string, (args: string[]) => Promise<void>> = {
  trial: trialCli,
  'training-score': trainingScoreCli,
}

const printCommandManifest = () => {
  const manifest = {
    name: 'plaited-improve',
    description: 'Improvement and calibration CLI for the Plaited project',
    commands: Object.keys(COMMANDS).sort(),
    usage: "plaited-improve <command> '<json>' | --schema input",
    discovery: 'plaited-improve --schema',
  }
  console.log(JSON.stringify(manifest, null, 2))
}

const command = Bun.argv[2]
const args = Bun.argv.slice(3)

if (!command || command === '--help' || command === '-h') {
  console.error(`Usage: plaited-improve <command> [options]
       plaited-improve <command> --schema   # Discover input schema
       plaited-improve <command> '<json>'   # Structured JSON input
       plaited-improve --schema             # List all commands

Commands:
  Improvement:
    trial, training-score`)
  process.exit(command ? 0 : 1)
}

if (command === '--schema') {
  printCommandManifest()
  process.exit(0)
}

const handler = COMMANDS[command]
if (!handler) {
  console.error(`Unknown command: ${command}`)
  console.error(`Run 'plaited-improve --help' to see available commands`)
  process.exit(1)
}

handler(args).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
