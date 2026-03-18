import type { SDKResultError, SDKResultSuccess } from '@anthropic-ai/claude-agent-sdk'
import { query } from '@anthropic-ai/claude-agent-sdk'

const PROJECT_ROOT = `${import.meta.dir}/..`
const CLIENT_APP = 'plaited-dev-autoresearch'
const CLAUDE_JUDGE_MAX_TURNS = 1
const JUDGE_DISALLOWED_TOOLS = ['Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Glob', 'Grep', 'LS', 'Skill', 'Task']

export type ClaudeQueryMetadata = {
  subtype: string
  totalCostUsd: number
  modelUsage: Record<string, unknown>
  permissionDenials: number
}

type StructuredResult<T> =
  | {
      ok: true
      value: T
      meta: ClaudeQueryMetadata
    }
  | {
      ok: false
      reason: string
      meta?: ClaudeQueryMetadata
    }

export const formatClaudeResultFailure = (message: SDKResultError | SDKResultSuccess): string => {
  const parts: string[] = [`subtype=${message.subtype}`]

  if ('errors' in message && message.errors.length > 0) {
    parts.push(`errors=${message.errors.join('; ')}`)
  }

  if (message.permission_denials.length > 0) {
    parts.push(`permission_denials=${message.permission_denials.length}`)
  }

  if ('result' in message && message.result) {
    parts.push(`result=${message.result}`)
  }

  return parts.join(' ')
}

const getClaudeQueryMetadata = (message: SDKResultError | SDKResultSuccess): ClaudeQueryMetadata => ({
  subtype: message.subtype,
  totalCostUsd: message.total_cost_usd,
  modelUsage: message.modelUsage,
  permissionDenials: message.permission_denials.length,
})

export const runStructuredClaudeQuery = async <T>({
  model,
  prompt,
  schema,
}: {
  model: string
  prompt: string
  schema: Record<string, unknown>
}): Promise<StructuredResult<T>> => {
  const agent = query({
    prompt,
    options: {
      cwd: PROJECT_ROOT,
      model,
      maxTurns: CLAUDE_JUDGE_MAX_TURNS,
      permissionMode: 'plan',
      disallowedTools: JUDGE_DISALLOWED_TOOLS,
      persistSession: false,
      settingSources: [],
      effort: 'low',
      env: {
        ...process.env,
        CLAUDE_AGENT_SDK_CLIENT_APP: CLIENT_APP,
      },
      outputFormat: {
        type: 'json_schema',
        schema,
      },
    },
  })

  try {
    for await (const message of agent) {
      if (message.type !== 'result') continue

      if (message.subtype === 'success' && message.structured_output) {
        return {
          ok: true,
          value: message.structured_output as T,
          meta: getClaudeQueryMetadata(message),
        }
      }

      return {
        ok: false,
        reason: formatClaudeResultFailure(message),
        meta: getClaudeQueryMetadata(message),
      }
    }

    return {
      ok: false,
      reason: 'Claude SDK returned no result message',
    }
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    }
  } finally {
    agent.close()
  }
}
