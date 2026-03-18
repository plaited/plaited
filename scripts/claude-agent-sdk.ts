import { query } from '@anthropic-ai/claude-agent-sdk'

const PROJECT_ROOT = `${import.meta.dir}/..`
const CLIENT_APP = 'plaited-dev-autoresearch'

type StructuredResult<T> =
  | {
      ok: true
      value: T
    }
  | {
      ok: false
      reason: string
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
      maxTurns: 1,
      permissionMode: 'dontAsk',
      persistSession: false,
      settingSources: [],
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
        reason: 'errors' in message ? message.errors.join('; ') : `Claude SDK returned subtype ${message.subtype}`,
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
