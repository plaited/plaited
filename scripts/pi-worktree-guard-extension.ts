import { isAbsolute, join, normalize } from 'node:path'
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'
import { createBashTool } from '@mariozechner/pi-coding-agent'
import { Type } from '@sinclair/typebox'
import { HypergraphQuerySchema, search as searchHypergraph } from '../src/hypergraph.ts'

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
  readRoots: string[]
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
  const readRoots = process.env.PLAITED_ALLOWED_READ_ROOTS?.trim()

  return {
    workspaceRoot,
    repoRoot: repoRoot ? normalizeFsPath(repoRoot) : undefined,
    allowedRoots: parseAllowedRoots({
      workspaceRoot,
      value: process.env.PLAITED_ALLOWED_WRITABLE_ROOTS,
    }),
    readRoots: parseAllowedRoots({
      workspaceRoot,
      value: readRoots && readRoots.length > 0 ? readRoots : process.env.PLAITED_ALLOWED_WRITABLE_ROOTS,
    }),
    enabled: process.env.PLAITED_SANDBOX_DISABLED !== '1',
  }
}

const HypergraphSearchParams = Type.Object({
  path: Type.String({ description: 'Directory containing JSON-LD graph artifacts, relative to the active worktree.' }),
  query: Type.String({
    description:
      'Hypergraph query kind: causal-chain, co-occurrence, check-cycles, match, similar, reachability, or provenance.',
  }),
  from: Type.Optional(Type.String({ description: 'Source vertex id for causal-chain.' })),
  to: Type.Optional(Type.String({ description: 'Target vertex id for causal-chain.' })),
  vertex: Type.Optional(Type.String({ description: 'Vertex id for co-occurrence.' })),
  pattern: Type.Optional(
    Type.Object({
      sequence: Type.Array(Type.String(), { description: 'Ordered sequence of hyperedge types for match.' }),
    }),
  ),
  embedding: Type.Optional(Type.Array(Type.Number(), { description: 'Embedding vector for similar queries.' })),
  topK: Type.Optional(Type.Number({ description: 'Top-K result count for similar queries.' })),
  startVertices: Type.Optional(Type.Array(Type.String(), { description: 'Start vertices for reachability.' })),
  vertexTypeFilter: Type.Optional(Type.Array(Type.String())),
  hyperedgeTypeFilter: Type.Optional(Type.Array(Type.String())),
  maxDepth: Type.Optional(Type.Number({ description: 'Maximum traversal depth for reachability.' })),
})

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

  pi.registerTool({
    name: 'search',
    label: 'search (hypergraph)',
    description:
      'Query retained JSON-LD seed/corpus artifacts semantically. Use this for graph anchors, provenance, cycles, reachability, and co-occurrence instead of raw file reads when possible.',
    parameters: HypergraphSearchParams,
    async execute(_id, params, signal, _onUpdate, ctx) {
      const parsed = HypergraphQuerySchema.parse(params)
      const resolvedPath = resolveWithinWorkspace({ workspaceRoot: policy.workspaceRoot, path: parsed.path })

      if (!isAllowedWorkspacePath({ path: resolvedPath, allowedRoots: policy.readRoots })) {
        return {
          content: [
            {
              type: 'text',
              text: `Graph query denied: "${parsed.path}" is outside the allowed read roots.`,
            },
          ],
          details: {
            error: true,
            path: parsed.path,
          },
        }
      }

      const result = await searchHypergraph(parsed, {
        workspace: ctx.cwd,
        env: {},
        signal: signal ?? AbortSignal.timeout(10_000),
      })

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        details: result,
      }
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
      ctx.ui.theme.fg(
        'accent',
        `sandbox: ${policy.allowedRoots.length} writable roots, ${policy.readRoots.length} read roots in worktree`,
      ),
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
