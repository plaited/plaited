import { isAbsolute, join, normalize } from 'node:path'
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'
import { createBashTool } from '@mariozechner/pi-coding-agent'

const DEFAULT_WRITABLE_ROOTS = ['.']

export const normalizeFsPath = (path: string) => normalize(path).replaceAll('\\', '/')

export const resolveWithinWorkspace = ({ workspaceRoot, path }: { workspaceRoot: string; path: string }) =>
  normalizeFsPath(isAbsolute(path) ? path : join(workspaceRoot, path))

export const parseAllowedRoots = ({ workspaceRoot, value }: { workspaceRoot: string; value?: string }) => {
  const roots = value
    ?.split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean)

  return (roots && roots.length > 0 ? roots : DEFAULT_WRITABLE_ROOTS).map((root) =>
    resolveWithinWorkspace({ workspaceRoot, path: root }),
  )
}

export const isAllowedWorkspacePath = ({ path, allowedRoots }: { path: string; allowedRoots: string[] }) => {
  const normalizedPath = normalizeFsPath(path)
  return allowedRoots.some((root) => normalizedPath === root || normalizedPath.startsWith(`${root}/`))
}

export default function worktreeGuardExtension(pi: ExtensionAPI) {
  const workspaceRoot = normalizeFsPath(process.env.PLAITED_WORKSPACE_ROOT?.trim() || process.cwd())
  const allowedRoots = parseAllowedRoots({
    workspaceRoot,
    value: process.env.PLAITED_ALLOWED_WRITABLE_ROOTS,
  })

  const bashTool = createBashTool(workspaceRoot, {
    spawnHook: ({ command, env }) => ({
      command,
      cwd: workspaceRoot,
      env: {
        ...env,
        PLAITED_WORKSPACE_ROOT: workspaceRoot,
      },
    }),
  })

  pi.registerTool({
    ...bashTool,
    execute: async (id, params, signal, onUpdate) => bashTool.execute(id, params, signal, onUpdate),
  })

  pi.on('tool_call', async (event, ctx) => {
    if (event.toolName !== 'write' && event.toolName !== 'edit') {
      return undefined
    }

    const requestedPath = typeof event.input.path === 'string' ? event.input.path : ''
    const resolvedPath = resolveWithinWorkspace({ workspaceRoot, path: requestedPath })

    if (isAllowedWorkspacePath({ path: resolvedPath, allowedRoots })) {
      return undefined
    }

    if (ctx.hasUI) {
      ctx.ui.notify(`Blocked out-of-scope write: ${requestedPath}`, 'warning')
    }

    return {
      block: true,
      reason: `Path "${requestedPath}" is outside the allowed writable roots`,
    }
  })
}
