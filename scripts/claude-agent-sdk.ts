import type { SDKResultError, SDKResultSuccess } from '@anthropic-ai/claude-agent-sdk'
import { query } from '@anthropic-ai/claude-agent-sdk'

const PROJECT_ROOT = `${import.meta.dir}/..`
const CLIENT_APP = 'plaited-dev-autoresearch'
const CLAUDE_JUDGE_MAX_TURNS = 1

type StructuredResult<T> =
  | {
      ok: true
      value: T
    }
  | {
      ok: false
      reason: string
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
        }
      }

      return {
        ok: false,
        reason: formatClaudeResultFailure(message),
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
