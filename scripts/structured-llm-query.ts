import { isAbsolute, join, normalize } from 'node:path'
import { z } from 'zod'
import { ReadFileConfigSchema } from '../src/agent/crud.schemas.ts'
import { readFile } from '../src/agent/crud.ts'
import { HypergraphQuerySchema, search as searchHypergraph } from '../src/hypergraph.ts'
import { extractFirstJsonObject, extractTaggedJsonObject } from './json-extract.ts'
import { buildOpenRouterHeaders, extractOpenRouterText } from './openrouter-adapter.ts'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const DEFAULT_PRIMARY_JUDGE_MODEL = 'z-ai/glm-5'
const DEFAULT_META_VERIFIER_MODEL = 'minimax/minimax-m2.5'
const DEFAULT_VALIDATION_RETRIES = 2
const DEFAULT_REQUEST_TIMEOUT_MS = 60_000
const DEFAULT_JSON_SYSTEM_PROMPT =
  'Return only a single JSON object that satisfies the user request. Do not include markdown fences or commentary.'

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>
      tool_calls?: Array<{
        id?: string
        type?: string
        function?: {
          name?: string
          arguments?: string
        }
      }>
    }
  }>
  usage?: {
    cost?: number
    prompt_tokens?: number
    completion_tokens?: number
  }
  model?: string
}

type StructuredLlmToolMessage =
  | { role: 'system' | 'user'; content: string }
  | {
      role: 'assistant'
      content: string | null
      tool_calls: Array<{
        id: string
        type: 'function'
        function: {
          name: string
          arguments: string
        }
      }>
    }
  | {
      role: 'tool'
      tool_call_id: string
      content: string
    }

export type WorkspaceReadAccess = {
  workspaceRoot: string
  allowedRoots: string[]
  maxToolRounds?: number
}

const READ_FILE_TOOL = {
  type: 'function',
  function: {
    name: 'read_file',
    description: 'Read a text file from the allowed workspace roots.',
    parameters: z.toJSONSchema(ReadFileConfigSchema),
  },
} as const

const HYPERGRAPH_SEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'search',
    description:
      'Query JSON-LD hypergraph artifacts under the allowed workspace roots. Use exact relative paths such as dev-research/mss-seed/seed or dev-research/behavioral-corpus/encoded when possible. For reachability, startVertices must be an array of strings and maxDepth must be a number.',
    parameters: z.toJSONSchema(HypergraphQuerySchema),
  },
} as const

export const extractStructuredJsonObject = (value: string): string => {
  const fenced = value.match(/```json\s*([\s\S]*?)```/u)
  if (fenced?.[1]) return fenced[1].trim()
  const tagged = extractTaggedJsonObject({
    text: value,
    tag: 'json',
  })
  if (tagged) return tagged
  const objectMatch = extractFirstJsonObject(value)
  if (objectMatch) return objectMatch
  throw new Error('No JSON object found in model output')
}

export const resolvePrimaryJudgeModel = (): string =>
  process.env.PLAITED_PRIMARY_JUDGE_MODEL?.trim() || DEFAULT_PRIMARY_JUDGE_MODEL

export const resolveMetaVerifierModel = (): string =>
  process.env.PLAITED_META_VERIFIER_MODEL?.trim() || DEFAULT_META_VERIFIER_MODEL

export const normalizeFsPath = (path: string) => normalize(path).replaceAll('\\', '/')

const resolveWithinWorkspace = ({ workspaceRoot, path }: { workspaceRoot: string; path: string }) =>
  normalizeFsPath(isAbsolute(path) ? path : join(workspaceRoot, path))

export const isAllowedReadPath = ({
  workspaceRoot,
  allowedRoots,
  path,
}: {
  workspaceRoot: string
  allowedRoots: string[]
  path: string
}) => {
  const resolvedPath = resolveWithinWorkspace({ workspaceRoot, path })
  const resolvedRoots = allowedRoots.map((root) => resolveWithinWorkspace({ workspaceRoot, path: root }))
  return resolvedRoots.some((root) => resolvedPath === root || resolvedPath.startsWith(`${root}/`))
}

const executeReadTool = async ({
  workspaceRoot,
  allowedRoots,
  args,
}: {
  workspaceRoot: string
  allowedRoots: string[]
  args: unknown
}) => {
  const parsed = ReadFileConfigSchema.parse(args)
  if (!isAllowedReadPath({ workspaceRoot, allowedRoots, path: parsed.path })) {
    throw new Error(`read_file path is outside allowed roots: ${parsed.path}`)
  }

  return readFile(parsed, {
    workspace: workspaceRoot,
    env: {},
    signal: AbortSignal.timeout(5000),
  })
}

const executeHypergraphTool = async ({
  workspaceRoot,
  allowedRoots,
  args,
}: {
  workspaceRoot: string
  allowedRoots: string[]
  args: unknown
}) => {
  const normalizedArgs =
    typeof args === 'object' && args !== null
      ? ({
          ...args,
          ...('startVertices' in args && typeof args.startVertices === 'string'
            ? { startVertices: [args.startVertices] }
            : {}),
          ...('maxDepth' in args && typeof args.maxDepth === 'string' ? { maxDepth: Number(args.maxDepth) } : {}),
          ...('topK' in args && typeof args.topK === 'string' ? { topK: Number(args.topK) } : {}),
        } satisfies Record<string, unknown>)
      : args

  const parsed = HypergraphQuerySchema.parse(normalizedArgs)
  if (!isAllowedReadPath({ workspaceRoot, allowedRoots, path: parsed.path })) {
    throw new Error(`search path is outside allowed roots: ${parsed.path}`)
  }

  return searchHypergraph(parsed, {
    workspace: workspaceRoot,
    env: {},
    signal: AbortSignal.timeout(10_000),
  })
}

export const runStructuredLlmQuery = async <T>({
  model,
  prompt,
  schema,
  systemPrompt = DEFAULT_JSON_SYSTEM_PROMPT,
  validationRetries = DEFAULT_VALIDATION_RETRIES,
  workspaceReadAccess,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
}: {
  model: string
  prompt: string
  schema: unknown
  systemPrompt?: string
  validationRetries?: number
  workspaceReadAccess?: WorkspaceReadAccess
  requestTimeoutMs?: number
}): Promise<
  { ok: true; value: T; meta?: Record<string, unknown> } | { ok: false; reason: string; meta?: Record<string, unknown> }
> => {
  let attempt = 0

  while (attempt <= validationRetries) {
    try {
      const messages: StructuredLlmToolMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ]
      const maxToolRounds = workspaceReadAccess?.maxToolRounds ?? 5
      let payload: (OpenRouterResponse & { error?: { message?: string } }) | null = null
      let response: Response | null = null
      let toolRounds = 0

      while (true) {
        response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: buildOpenRouterHeaders(),
          signal: AbortSignal.timeout(requestTimeoutMs),
          body: JSON.stringify({
            model,
            messages,
            ...(workspaceReadAccess ? { tools: [READ_FILE_TOOL, HYPERGRAPH_SEARCH_TOOL] } : {}),
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'plaited_structured_output',
                strict: true,
                schema,
              },
            },
          }),
        })

        payload = (await response.json()) as OpenRouterResponse & { error?: { message?: string } }
        if (!response.ok) {
          const message =
            typeof payload.error?.message === 'string'
              ? payload.error.message
              : `${response.status} ${response.statusText}`
          return {
            ok: false,
            reason: message,
            meta: {
              source: 'openrouter-api',
              model,
              status: response.status,
              attempt: attempt + 1,
            },
          }
        }

        const message = payload.choices?.[0]?.message
        const toolCalls = message?.tool_calls ?? []
        if (!workspaceReadAccess || toolCalls.length === 0) {
          break
        }

        if (toolRounds >= maxToolRounds) {
          return {
            ok: false,
            reason: 'Structured LLM query exceeded tool-calling round limit.',
            meta: {
              source: 'openrouter-api',
              model,
              attempt: attempt + 1,
              toolRounds,
            },
          }
        }

        messages.push({
          role: 'assistant',
          content: typeof message?.content === 'string' ? message.content : null,
          tool_calls: toolCalls.map((toolCall, index) => ({
            id: toolCall.id ?? `tool_${toolRounds}_${index}`,
            type: 'function',
            function: {
              name: toolCall.function?.name ?? 'unknown',
              arguments: toolCall.function?.arguments ?? '{}',
            },
          })),
        })

        for (const toolCall of toolCalls) {
          const name = toolCall.function?.name ?? ''
          if (name !== 'read_file' && name !== 'search') {
            return {
              ok: false,
              reason: `Unsupported tool requested by model: ${name || 'unknown'}`,
              meta: {
                source: 'openrouter-api',
                model,
                attempt: attempt + 1,
              },
            }
          }

          const argumentsText = toolCall.function?.arguments ?? '{}'
          const parsedArguments = JSON.parse(argumentsText) as unknown
          const toolResult =
            name === 'read_file'
              ? await executeReadTool({
                  workspaceRoot: workspaceReadAccess.workspaceRoot,
                  allowedRoots: workspaceReadAccess.allowedRoots,
                  args: parsedArguments,
                })
              : await executeHypergraphTool({
                  workspaceRoot: workspaceReadAccess.workspaceRoot,
                  allowedRoots: workspaceReadAccess.allowedRoots,
                  args: parsedArguments,
                })

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id ?? `tool_${toolRounds}`,
            content: JSON.stringify(toolResult),
          })
        }

        toolRounds += 1
      }

      const text = extractOpenRouterText(payload as OpenRouterResponse)
      return {
        ok: true,
        value: JSON.parse(extractStructuredJsonObject(text)) as T,
        meta: {
          source: 'openrouter-api',
          model: payload?.model ?? model,
          totalCostUsd: typeof payload?.usage?.cost === 'number' ? payload.usage.cost : 0,
          usage: {
            promptTokens: payload?.usage?.prompt_tokens ?? 0,
            completionTokens: payload?.usage?.completion_tokens ?? 0,
          },
          attempt: attempt + 1,
          toolRounds,
        },
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      const shouldRetry =
        attempt < validationRetries &&
        (reason.includes('No JSON object found') ||
          reason.includes('Unexpected token') ||
          reason.includes('JSON') ||
          reason.includes('Invalid input'))

      if (shouldRetry) {
        attempt += 1
        continue
      }

      return {
        ok: false,
        reason,
        meta: {
          source: 'openrouter-api',
          model,
          attempt: attempt + 1,
          requestTimeoutMs,
        },
      }
    }
  }

  return {
    ok: false,
    reason: 'Structured LLM query exhausted validation retries.',
    meta: {
      source: 'openrouter-api',
      model,
      attempt: validationRetries + 1,
      requestTimeoutMs,
    },
  }
}
