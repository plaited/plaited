import Anthropic from '@anthropic-ai/sdk'
import type { ToolDefinition } from '../agent.schemas.ts'
import type { ChatMessage, Model } from '../agent.types.ts'

/**
 * Configuration for the Anthropic Claude API backend.
 *
 * @public
 */
export type AnthropicOptions = {
  /** Anthropic API key */
  apiKey: string
  /** Model identifier (default: "claude-sonnet-4-6") */
  model?: string
  /** Maximum output tokens (default: 16384) */
  maxTokens?: number
}

/**
 * Convert OpenAI-format ChatMessage[] to Anthropic MessageParam[].
 *
 * @remarks
 * Handles the key structural differences:
 * - System messages are extracted separately (Anthropic uses a top-level `system` param)
 * - Assistant tool_calls become `tool_use` content blocks
 * - Consecutive `tool` role messages are grouped into a single `user` message
 *   with `tool_result` blocks (Anthropic requires alternating user/assistant)
 */
const toAnthropicMessages = (messages: ChatMessage[]): Anthropic.MessageParam[] => {
  const result: Anthropic.MessageParam[] = []

  for (let i = 0; i < messages.length; ) {
    const msg = messages[i]!

    if (msg.role === 'system') {
      i++
      continue
    }

    if (msg.role === 'user') {
      result.push({ role: 'user', content: msg.content ?? '' })
      i++
      continue
    }

    if (msg.role === 'assistant') {
      if (msg.tool_calls?.length) {
        const content: (Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam)[] = []
        if (msg.content) content.push({ type: 'text', text: msg.content })
        for (const tc of msg.tool_calls) {
          const raw = tc as { id: string; function: { name: string; arguments: string | Record<string, unknown> } }
          let input: Record<string, unknown> = {}
          try {
            input =
              typeof raw.function.arguments === 'string' ? JSON.parse(raw.function.arguments) : raw.function.arguments
          } catch {
            input = { _raw: String(raw.function.arguments) }
          }
          content.push({ type: 'tool_use', id: raw.id, name: raw.function.name, input })
        }
        result.push({ role: 'assistant', content })
      } else {
        result.push({ role: 'assistant', content: msg.content ?? '' })
      }
      i++
      continue
    }

    if (msg.role === 'tool') {
      // Group consecutive tool messages into one user message
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      while (i < messages.length && messages[i]!.role === 'tool') {
        const toolMsg = messages[i]!
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolMsg.tool_call_id!,
          content: toolMsg.content ?? '',
        })
        i++
      }
      result.push({ role: 'user', content: toolResults })
      continue
    }

    i++
  }

  return result
}

/** Convert ToolDefinition[] to Anthropic Tool[] */
const toAnthropicTools = (tools: ToolDefinition[]): Anthropic.Tool[] =>
  tools.map((t) => ({
    name: t.function.name,
    description: t.function.description ?? '',
    input_schema: (t.function.parameters ?? {
      type: 'object' as const,
      properties: {},
    }) as Anthropic.Tool.InputSchema,
  }))

/**
 * Creates a Model for the Anthropic Claude API.
 *
 * @remarks
 * Uses `@anthropic-ai/sdk` with SSE streaming and adaptive thinking.
 * Converts between OpenAI-compatible `ChatMessage` format and Anthropic's
 * native message format. The SDK handles 429/5xx retry with exponential
 * backoff internally (default: 2 retries).
 *
 * @public
 */
export const createAnthropicModel = ({
  apiKey,
  model = 'claude-sonnet-4-6',
  maxTokens = 16_384,
}: AnthropicOptions): Model => {
  const client = new Anthropic({ apiKey })

  return {
    reason: async function* ({ messages, tools, temperature, signal }) {
      const systemMessages = messages.filter((m) => m.role === 'system')
      const system = systemMessages.map((m) => m.content ?? '').join('\n') || undefined
      const anthropicMessages = toAnthropicMessages(messages)

      /** Track content block index → tool use id */
      const toolUseBlocks = new Map<number, string>()

      try {
        const stream = client.messages.stream(
          {
            model,
            max_tokens: maxTokens,
            messages: anthropicMessages,
            thinking: { type: 'enabled', budget_tokens: maxTokens - 1024 },
            ...(system && { system }),
            ...(tools?.length && { tools: toAnthropicTools(tools) }),
            ...(temperature !== undefined && { temperature }),
          },
          { signal },
        )

        for await (const event of stream) {
          signal.throwIfAborted()

          if (event.type === 'content_block_start') {
            if (event.content_block.type === 'tool_use') {
              toolUseBlocks.set(event.index, event.content_block.id)
              yield { type: 'toolcall_delta', id: event.content_block.id, name: event.content_block.name }
            }
          } else if (event.type === 'content_block_delta') {
            if (event.delta.type === 'thinking_delta') {
              yield { type: 'thinking_delta', content: event.delta.thinking }
            } else if (event.delta.type === 'text_delta') {
              yield { type: 'text_delta', content: event.delta.text }
            } else if (event.delta.type === 'input_json_delta') {
              const id = toolUseBlocks.get(event.index)
              if (id) {
                yield { type: 'toolcall_delta', id, arguments: event.delta.partial_json }
              }
            }
          }
        }

        const final = await stream.finalMessage()
        yield {
          type: 'done',
          response: {
            usage: {
              inputTokens: final.usage.input_tokens,
              outputTokens: final.usage.output_tokens,
            },
          },
        }
      } catch (err) {
        if (signal.aborted) throw err
        yield { type: 'error', error: err instanceof Error ? err.message : String(err) }
      }
    },
  }
}
