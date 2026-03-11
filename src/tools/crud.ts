import { resolve } from 'node:path'
import { $ } from 'bun'
import { RISK_TAG } from '../agent/agent.constants.ts'
import type { ToolHandler } from '../agent/agent.types.ts'
import { makeCli } from './cli.utils.ts'
import {
  BashConfigSchema,
  EditFileConfigSchema,
  ListFilesConfigSchema,
  ReadFileConfigSchema,
  WriteFileConfigSchema,
} from './crud.schemas.ts'

// ============================================================================
// Risk Tag Registry — static declarations per built-in tool
// ============================================================================

/**
 * Static risk tag declarations for built-in tools.
 *
 * @remarks
 * Gate bThread predicates inspect these tags to determine routing:
 * - `workspace`-only → execute directly (safe path)
 * - Empty tags → default-deny, routes to Simulate + Judge
 *
 * @public
 */
export const BUILT_IN_RISK_TAGS: Record<string, string[]> = {
  read_file: [RISK_TAG.workspace],
  write_file: [RISK_TAG.workspace],
  edit_file: [RISK_TAG.workspace],
  list_files: [RISK_TAG.workspace],
  bash: [], // empty → default-deny, routes to Simulate + Judge
}

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * Read a file's contents as text.
 *
 * @public
 */
export const readFile: ToolHandler = async (args, ctx) => {
  const path = args.path as string
  const resolved = resolve(ctx.workspace, path)
  return await Bun.file(resolved).text()
}

/**
 * Write content to a file, creating parent directories as needed.
 *
 * @public
 */
export const writeFile: ToolHandler = async (args, ctx) => {
  const path = args.path as string
  const content = args.content as string
  const resolved = resolve(ctx.workspace, path)
  await Bun.write(resolved, content)
  return { written: path, bytes: content.length }
}

/**
 * Replace a unique string in a file with new content.
 *
 * @remarks
 * Fails if `old_string` is not found or appears more than once.
 * This prevents ambiguous edits.
 *
 * @public
 */
export const editFile: ToolHandler = async (args, ctx) => {
  const path = args.path as string
  const oldString = args.old_string as string
  const newString = args.new_string as string
  const resolved = resolve(ctx.workspace, path)

  const content = await Bun.file(resolved).text()
  const firstIdx = content.indexOf(oldString)
  if (firstIdx === -1) {
    throw new Error(`old_string not found in ${path}`)
  }
  const secondIdx = content.indexOf(oldString, firstIdx + 1)
  if (secondIdx !== -1) {
    throw new Error(`old_string is not unique in ${path} (found at positions ${firstIdx} and ${secondIdx})`)
  }

  const updated = content.replace(oldString, newString)
  await Bun.write(resolved, updated)
  return { edited: path, bytes: updated.length }
}

/**
 * List files and directories matching a glob pattern.
 *
 * @public
 */
export const listFiles: ToolHandler = async (args, ctx) => {
  const pattern = (args.pattern as string) ?? '**/*'
  const glob = new Bun.Glob(pattern)
  const entries: Array<{ path: string; type: 'file' | 'directory'; size?: number }> = []
  for await (const path of glob.scan({ cwd: ctx.workspace, onlyFiles: false })) {
    const resolved = resolve(ctx.workspace, path)
    const ref = Bun.file(resolved)
    const isFile = await ref.exists()
    entries.push(isFile ? { path, type: 'file', size: ref.size } : { path, type: 'directory' })
  }
  return entries
}

/**
 * Execute a shell command via Bun Shell.
 *
 * @remarks
 * Uses `Bun.$` (not `/bin/sh`) for sandboxing:
 * - `.cwd(workspace)` locks working directory
 * - `.nothrow()` captures exit code without throwing
 * - `.quiet()` captures stdout/stderr as Buffers
 * - `{ raw: command }` passes the command string to Bun Shell's parser
 *
 * Constitution bThreads inspect the command at the Gate (Layer 1) before
 * execution reaches this handler.
 *
 * @public
 */
export const bash: ToolHandler = async (args, ctx) => {
  const command = args.command as string
  if (ctx.signal.aborted) throw new Error('Aborted')

  const result = await $`${{ raw: command }}`.cwd(ctx.workspace).nothrow().quiet()

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString().trim() || `Command exited with code ${result.exitCode}`)
  }
  return result.stdout.toString().trim()
}

/**
 * Built-in handler registry keyed by tool name.
 *
 * @remarks
 * Used by BP dispatch to look up handlers for `execute` events.
 *
 * @public
 */
export const builtInHandlers: Record<string, ToolHandler> = {
  read_file: readFile,
  write_file: writeFile,
  edit_file: editFile,
  list_files: listFiles,
  bash,
}

// ============================================================================
// CLI Handlers (CLI tool pattern — thin wrappers over library handlers)
// ============================================================================

export const readFileCli = makeCli(readFile, ReadFileConfigSchema, 'read-file')
export const writeFileCli = makeCli(writeFile, WriteFileConfigSchema, 'write-file')
export const editFileCli = makeCli(editFile, EditFileConfigSchema, 'edit-file')
export const listFilesCli = makeCli(listFiles, ListFilesConfigSchema, 'list-files')
export const bashCli = makeCli(bash, BashConfigSchema, 'bash')
