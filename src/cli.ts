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

import { classifyRiskCli } from './tools/constitution/constitution.ts'
// Agent tools (CRUD)
import { bashCli, listFilesCli, readFileCli, writeFileCli } from './tools/crud/crud.ts'
import { balance } from './tools/eval/commands/balance.ts'
import { calibrate } from './tools/eval/commands/calibrate.ts'
import { capture } from './tools/eval/commands/capture.ts'
// Eval harness
import { evalRun } from './tools/eval/commands/eval-run.ts'
import { summarize } from './tools/eval/commands/summarize.ts'
import { trials } from './tools/eval/commands/trials.ts'
import { validateRefs } from './tools/eval/commands/validate-refs.ts'
import { headless } from './tools/eval/headless/headless-cli.ts'
import { compare } from './tools/eval/pipeline/compare.ts'
import { extract } from './tools/eval/pipeline/extract.ts'
import { format } from './tools/eval/pipeline/format.ts'
import { grade } from './tools/eval/pipeline/grade.ts'
// Pipeline commands
import { run } from './tools/eval/pipeline/run.ts'
import { schemasCli } from './tools/eval/schemas/schemas-cli.ts'
import { evaluateCli } from './tools/evaluate/evaluate.ts'
// Agent services
import { searchCli } from './tools/memory/memory.ts'
// Development tools
import { scaffoldRules } from './tools/scaffold-rules/scaffold-rules.ts'
import { simulateCli } from './tools/simulate/simulate.ts'
import { lsp } from './tools/typescript-lsp/lsp.ts'
import { validateSkill } from './tools/validate-skill/validate-skill.ts'

// ============================================================================
// Command Registry
// ============================================================================

const COMMANDS: Record<string, (args: string[]) => Promise<void>> = {
  // Agent tools (CRUD)
  'read-file': readFileCli,
  'write-file': writeFileCli,
  'list-files': listFilesCli,
  bash: bashCli,
  // Agent services
  search: searchCli,
  'classify-risk': classifyRiskCli,
  simulate: simulateCli,
  evaluate: evaluateCli,
  // Eval harness
  eval: evalRun,
  capture,
  trials,
  summarize,
  calibrate,
  balance,
  'validate-refs': validateRefs,
  schemas: schemasCli,
  headless,
  // Pipeline commands
  run,
  extract,
  grade,
  format,
  compare,
  // Development tools
  'scaffold-rules': scaffoldRules,
  'validate-skill': validateSkill,
  lsp,
}

// ============================================================================
// Top-level --schema: Command manifest
// ============================================================================

const printCommandManifest = () => {
  const manifest = {
    name: 'plaited',
    description: 'Agent-facing CLI toolbox for the Plaited framework',
    commands: Object.keys(COMMANDS).sort(),
    usage: "plaited <command> --schema | --json '{...}'",
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
       plaited <command> --schema     # Discover command schema
       plaited <command> --json '{}'  # Structured input
       plaited --schema               # List all commands

Commands:
  Agent Tools:
    read-file, write-file, list-files, bash

  Agent Services:
    search, classify-risk, simulate, evaluate

  Eval Harness:
    eval, capture, trials, summarize, calibrate,
    balance, validate-refs, schemas, headless

  Pipeline:
    run, extract, grade, format, compare

  Development:
    scaffold-rules, validate-skill, lsp`)
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
