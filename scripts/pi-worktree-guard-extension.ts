import { isAbsolute, join, normalize } from 'node:path'
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'
import { createBashTool } from '@mariozechner/pi-coding-agent'

const DEFAULT_WRITABLE_ROOTS = ['.']
const NESTED_AUTORESEARCH_PATTERNS = [
  /\bgit\s+worktree\b/i,
  /\bbun\s+run\s+research:mss-(seed|corpus)\b/i,
  /\bbun\s+scripts\/autoresearch-runner\.ts\b/i,
  /(^|[\s"'`])\.prompts([/\s"'`]|$)/,
  /(^|[\s"'`])\.git\/worktrees([/\s"'`]|$)/,
]

export type SandboxPolicy = {
  workspaceRoot: string
  repoRoot?: string
  allowedRoots: string[]
  enabled: boolean
}

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

export const buildSandboxPolicy = (): SandboxPolicy => {
  const workspaceRoot = normalizeFsPath(process.env.PLAITED_WORKSPACE_ROOT?.trim() || process.cwd())
  const repoRoot = process.env.PLAITED_REPO_ROOT?.trim()

  return {
    workspaceRoot,
    repoRoot: repoRoot ? normalizeFsPath(repoRoot) : undefined,
    allowedRoots: parseAllowedRoots({
      workspaceRoot,
      value: process.env.PLAITED_ALLOWED_WRITABLE_ROOTS,
    }),
    enabled: process.env.PLAITED_SANDBOX_DISABLED !== '1',
  }
}

export const getBashCommandViolations = ({ command, policy }: { command: string; policy: SandboxPolicy }) => {
  const violations: string[] = []
  const normalizedCommand = command.trim()

  if (normalizedCommand.length === 0 || !policy.enabled) {
    return violations
  }

  for (const pattern of NESTED_AUTORESEARCH_PATTERNS) {
    if (pattern.test(normalizedCommand)) {
      violations.push('nested autoresearch/worktree operations are blocked')
      break
    }
  }

  if (
    policy.repoRoot &&
    normalizedCommand.includes(policy.repoRoot) &&
    !normalizedCommand.includes(policy.workspaceRoot)
  ) {
    violations.push('commands must use the active worktree, not the canonical repo root')
  }

  return violations
}

export default function worktreeGuardExtension(pi: ExtensionAPI) {
  pi.registerFlag('no-sandbox', {
    description: 'Disable Pi worktree sandboxing for bash commands',
    type: 'boolean',
    default: false,
  })

  const policy = buildSandboxPolicy()
  const localBash = createBashTool(policy.workspaceRoot, {
    spawnHook: ({ command, env }) => ({
      command,
      cwd: policy.workspaceRoot,
      env: {
        ...env,
        PLAITED_WORKSPACE_ROOT: policy.workspaceRoot,
        PLAITED_REPO_ROOT: policy.repoRoot ?? '',
      },
    }),
  })

  pi.registerTool({
    ...localBash,
    label: 'bash (sandboxed)',
    async execute(id, params, signal, onUpdate) {
      return localBash.execute(id, params, signal, onUpdate)
    },
  })

  pi.on('session_start', async (_event, ctx) => {
    const noSandbox = pi.getFlag('no-sandbox') as boolean
    if (noSandbox) {
      ctx.ui.notify('Pi sandbox disabled via --no-sandbox', 'warning')
      return
    }

    if (!policy.enabled) {
      ctx.ui.notify('Pi sandbox disabled via environment', 'warning')
      return
    }

    ctx.ui.setStatus(
      'sandbox',
      ctx.ui.theme.fg('accent', `sandbox: ${policy.allowedRoots.length} writable roots in worktree`),
    )
  })

  pi.on('tool_call', async (event, ctx) => {
    if ((event.toolName === 'write' || event.toolName === 'edit') && policy.enabled) {
      const requestedPath = typeof event.input.path === 'string' ? event.input.path : ''
      const resolvedPath = resolveWithinWorkspace({ workspaceRoot: policy.workspaceRoot, path: requestedPath })

      if (isAllowedWorkspacePath({ path: resolvedPath, allowedRoots: policy.allowedRoots })) {
        return undefined
      }

      if (ctx.hasUI) {
        ctx.ui.notify(`Blocked out-of-scope write: ${requestedPath}`, 'warning')
      }

      return {
        block: true,
        reason: `Path "${requestedPath}" is outside the allowed writable roots`,
      }
    }

    if (event.toolName === 'bash' && policy.enabled) {
      const command = typeof event.input.command === 'string' ? event.input.command : ''
      const violations = getBashCommandViolations({ command, policy })

      if (violations.length === 0) {
        return undefined
      }

      if (ctx.hasUI) {
        ctx.ui.notify(`Blocked bash command: ${violations.join('; ')}`, 'warning')
      }

      return {
        block: true,
        reason: violations.join('; '),
      }
    }

    return undefined
  })
}
