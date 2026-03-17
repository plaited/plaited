/**
 * CLI handlers for node and module workspace initialization.
 *
 * @remarks
 * Uses `parseCli` for JSON input, `--schema`, and `--help` support.
 * These are development/provisioning commands, not agent tools.
 *
 * @internal
 */

import { resolve } from 'node:path'
import * as z from 'zod'
import { parseCli } from '../tools/cli.utils.ts'
import { ModnetFieldSchema } from './modnet.schemas.ts'
import { initModule, initNodeWorkspace } from './workspace.ts'

// ============================================================================
// Init Node CLI
// ============================================================================

const InitNodeInputSchema = z.object({
  path: z.string().describe('Path for the new node workspace directory'),
  scope: z.string().describe('npm scope for module packages (e.g., "@mynode")'),
  name: z.string().optional().describe('Human-readable node name (defaults to directory basename)'),
})

export const initNodeCli = async (args: string[]): Promise<void> => {
  const input = await parseCli(args, InitNodeInputSchema, { name: 'init-node' })
  const path = resolve(input.path)
  await initNodeWorkspace({ ...input, path })
  // biome-ignore lint/suspicious/noConsole: CLI stdout output
  console.log(JSON.stringify({ created: path }))
}

// ============================================================================
// Init Module CLI
// ============================================================================

const InitModuleInputSchema = z.object({
  name: z.string().describe('Module name (used for directory and package name)'),
  nodePath: z.string().optional().describe('Path to node workspace root (default: cwd)'),
  modnet: ModnetFieldSchema.optional().describe('MSS bridge-code tags'),
})

export const initModuleCli = async (args: string[]): Promise<void> => {
  const input = await parseCli(args, InitModuleInputSchema, { name: 'init-module' })
  const nodePath = resolve(input.nodePath ?? process.cwd())
  await initModule({ nodePath, name: input.name, modnet: input.modnet })
  // biome-ignore lint/suspicious/noConsole: CLI stdout output
  console.log(JSON.stringify({ created: `${nodePath}/modules/${input.name}` }))
}
