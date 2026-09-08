/**
 * Agent-facing Open Responses tools — `model-respond` and `model-compact`.
 *
 * @remarks
 * Stateless `useTool` units (same shape as mcp-client / skill-client /
 * discovery): the model is one tool in the fixed set, not the thing the harness
 * is built around. Threads (the future agentic loop) orchestrate respond →
 * function_call → dispatch → function_call_output → respond; these tools stay
 * dumb. `function_call` output items come back as data and are never executed
 * here.
 *
 * Endpoint config (URL + resolved API key + extra headers) is
 * **provisioner-injected** via {@link createModelTools} — never model-facing.
 * The model-facing input carries `provider` (a routing selector over the
 * provisioned map) and `modelId`; a URL or key in tool input would leak a
 * secret into the transcript. Keys are resolved from the keychain (Bun.secrets)
 * at provisioning time by the caller, following the BunKeychainOAuthProvider
 * precedent — this factory only accepts already-resolved values.
 *
 * Multi-model routing falls out of threads choosing a `provider` label — no
 * router object, no adapter layer. Fetch is inline in the tool handler; the
 * loopback fixture (`tests/model-server-fixture.ts`) is the test boundary.
 *
 * @packageDocumentation
 */

import type { JSONSchemaType } from 'ajv'
import {
  ajv,
  ErrorSchema,
  type FunctionTool,
  FunctionToolSchema,
  type InputItem,
  InputItemSchema,
  type KnownStreamEvent,
  KnownStreamEventSchema,
  type Error as OpenResponsesError,
  type OpenResponsesStreamEvent,
  type OutputItem,
  OutputItemSchema,
  StreamEventLaxSchema,
  type Truncation,
  TruncationSchema,
  type Usage,
  UsageSchema,
} from './open-responses.schemas.ts'
import { useTool } from './use-tool.ts'

// ---------------------------------------------------------------------------
// Provisioner-injected endpoint config
// ---------------------------------------------------------------------------

/**
 * One provisioned Open Responses endpoint. `apiKey` must already be resolved
 * (e.g. from the OS keychain via Bun.secrets at provisioning time) — it is
 * never accepted from tool input.
 */
export type ModelEndpointConfig = {
  url: string
  apiKey?: string
  headers?: Record<string, string>
}

/** Provider label → endpoint config. Provisioner-injected, never model-facing. */
export type ModelEndpoints = Record<string, ModelEndpointConfig>

// ---------------------------------------------------------------------------
// model-respond — input / output
// ---------------------------------------------------------------------------

export type ModelRespondInput = {
  provider: string
  modelId: string
  input: InputItem[]
  tools?: FunctionTool[]
  instructions?: string
  truncation?: Truncation
  stream?: boolean
}

/**
 * Success: items + terminal status (+ usage / structured error, and the full
 * buffered event list when streaming). Errors are data, never throws:
 * `{ isError: true, message }` for unknown provider / transport / HTTP failure.
 */
export type ModelRespondOutput =
  | {
      items: OutputItem[]
      status: string
      events?: OpenResponsesStreamEvent[]
      usage?: Usage
      error?: OpenResponsesError
    }
  | { isError: true; message: string }

// ---------------------------------------------------------------------------
// JSON schemas — embed the open-responses AJV schemas (inputContentPartJsonSchema
// precedent in read.ts: cast through `unknown` because JSONSchemaType cannot
// statically verify discriminated oneOf; AJV validates at runtime).
// ---------------------------------------------------------------------------

const inputItemJsonSchema = InputItemSchema.schema
const functionToolJsonSchema = FunctionToolSchema.schema
const outputItemJsonSchema = OutputItemSchema.schema
const usageJsonSchema = UsageSchema.schema
const errorJsonSchema = ErrorSchema.schema
const truncationJsonSchema = TruncationSchema.schema

export const ModelRespondInputSchema = {
  type: 'object',
  properties: {
    provider: {
      type: 'string',
      minLength: 1,
      description: 'provisioned endpoint selector — maps to a URL + key injected at provisioning',
    },
    modelId: { type: 'string', minLength: 1, description: 'model identifier at the endpoint' },
    input: { type: 'array', items: inputItemJsonSchema, description: 'conversation transcript items' },
    tools: { type: 'array', items: functionToolJsonSchema, nullable: true },
    instructions: { type: 'string', nullable: true },
    truncation: { ...truncationJsonSchema, nullable: true },
    stream: { type: 'boolean', nullable: true, description: 'request SSE streaming' },
  },
  required: ['provider', 'modelId', 'input'],
  additionalProperties: false,
  description:
    'Send input items to a provisioned Open Responses endpoint and get back output items. ' +
    'function_call items are returned as data — dispatch them yourself.',
} as unknown as JSONSchemaType<ModelRespondInput>

export const ModelRespondOutputSchema = {
  type: 'object',
  oneOf: [
    {
      type: 'object',
      properties: {
        items: { type: 'array', items: outputItemJsonSchema },
        status: { type: 'string' },
        events: { type: 'array', items: { type: 'object' }, nullable: true },
        usage: { ...usageJsonSchema, nullable: true },
        error: { ...errorJsonSchema, nullable: true },
      },
      required: ['items', 'status'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        isError: { const: true },
        message: { type: 'string' },
      },
      required: ['isError', 'message'],
      additionalProperties: false,
    },
  ],
  description: 'Output items + status on success; { isError, message } on failure.',
} as unknown as JSONSchemaType<ModelRespondOutput>

// ---------------------------------------------------------------------------
// Wire helpers — build the spec request body (model is a plain string on the
// wire per the Open Responses spec / compliance suite; the internal
// OpenResponsesRequestSchema `model: { provider, modelId }` shape is not the
// wire format).
// ---------------------------------------------------------------------------

const joinUrl = (base: string, path: string): string => `${base.replace(/\/$/, '')}${path}`

const buildHeaders = (endpoint: ModelEndpointConfig): Record<string, string> => ({
  'content-type': 'application/json',
  ...(endpoint.apiKey !== undefined && { authorization: `Bearer ${endpoint.apiKey}` }),
  ...endpoint.headers,
})

const buildRespondBody = (input: ModelRespondInput): Record<string, unknown> => {
  const body: Record<string, unknown> = { model: input.modelId, input: input.input }
  if (input.tools !== undefined) body.tools = input.tools
  if (input.instructions !== undefined) body.instructions = input.instructions
  if (input.truncation !== undefined) body.truncation = input.truncation
  if (input.stream === true) body.stream = true
  return body
}

/**
 * Parse `data: {json}\n\n` SSE frames; `data: [DONE]` terminates.
 * MINIMAL: whole-body buffering — events are returned after the response
 * completes, with no mid-stream progress into the space. The thread replays
 * the buffered events as triggers. Upgrade path: a provisioner-injected
 * `onEvent` callback for mid-stream triggers.
 */
const consumeSseStream = (raw: string): ModelRespondOutput => {
  const events: OpenResponsesStreamEvent[] = []
  const knownEvents: KnownStreamEvent[] = []
  for (const frame of raw.split('\n\n')) {
    const line = frame.split('\n').find((l) => l.startsWith('data: '))
    if (line === undefined) continue
    const payload = line.slice('data: '.length).trim()
    if (payload.length === 0) continue
    if (payload === '[DONE]') break
    let data: unknown
    try {
      data = JSON.parse(payload)
    } catch {
      return { isError: true, message: `malformed SSE frame: ${payload.slice(0, 120)}` }
    }
    // Strict known-event validation first (full discrimination for assembly);
    // unknown provider extras fall through to the lax passthrough schema.
    const known = KnownStreamEventSchema.safeParse(data)
    if (known.success) {
      events.push(known.data)
      knownEvents.push(known.data)
      continue
    }
    const lax = StreamEventLaxSchema.safeParse(data)
    if (!lax.success) {
      return { isError: true, message: `invalid stream event: ${lax.error.message}` }
    }
    events.push(lax.data)
  }

  // Assemble: items from terminal output_item.done events, status/usage/error
  // from the terminal completed/failed/incomplete event.
  const items: OutputItem[] = []
  let status = 'completed'
  let usage: Usage | undefined
  let error: OpenResponsesError | undefined
  for (const ev of knownEvents) {
    if (ev.type === 'response.output_item.done') {
      items.push(ev.item)
    } else if (ev.type === 'response.completed') {
      status = 'completed'
      usage = ev.usage
    } else if (ev.type === 'response.failed') {
      status = 'failed'
      error = ev.error
      usage = ev.usage
    } else if (ev.type === 'response.incomplete') {
      status = 'incomplete'
      usage = ev.usage
    }
  }
  return {
    events,
    items,
    status,
    ...(usage !== undefined && { usage }),
    ...(error !== undefined && { error }),
  }
}

/**
 * Structured error body ({ error: { code, message } }) on a non-2xx response,
 * per the spec. Falls back to the raw body text when the shape doesn't match.
 */
const describeHttpError = async (res: Response): Promise<string> => {
  let detail = ''
  try {
    const raw = await res.text()
    const parsed = JSON.parse(raw) as { error?: { code?: unknown; message?: unknown } }
    if (parsed.error && typeof parsed.error === 'object') {
      const { code, message } = parsed.error
      detail = `${typeof code === 'string' ? code : 'unknown_error'}: ${typeof message === 'string' ? message : raw}`
    } else {
      detail = raw
    }
  } catch {
    detail = ''
  }
  return `HTTP ${res.status}${detail ? ` — ${detail}` : ''}`
}

// ---------------------------------------------------------------------------
// model-compact — input / output
// ---------------------------------------------------------------------------

export type ModelCompactInput = {
  provider: string
  modelId: string
  input: InputItem[]
  promptCacheKey?: string
}

export type ModelCompactOutput = { encrypted_content: string; usage?: Usage } | { isError: true; message: string }

export const ModelCompactInputSchema = {
  type: 'object',
  properties: {
    provider: {
      type: 'string',
      minLength: 1,
      description: 'provisioned endpoint selector — maps to a URL + key injected at provisioning',
    },
    modelId: { type: 'string', minLength: 1, description: 'model identifier at the endpoint' },
    input: { type: 'array', items: inputItemJsonSchema, description: 'conversation transcript items to compact' },
    promptCacheKey: { type: 'string', nullable: true },
  },
  required: ['provider', 'modelId', 'input'],
  additionalProperties: false,
  description:
    'Compact a conversation via the endpoint /v1/responses/compact. Returns encrypted_content ' +
    'to pass back as a compaction input item on the next respond call.',
} as unknown as JSONSchemaType<ModelCompactInput>

export const ModelCompactOutputSchema = {
  type: 'object',
  oneOf: [
    {
      type: 'object',
      properties: {
        encrypted_content: { type: 'string' },
        usage: { ...usageJsonSchema, nullable: true },
      },
      required: ['encrypted_content'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        isError: { const: true },
        message: { type: 'string' },
      },
      required: ['isError', 'message'],
      additionalProperties: false,
    },
  ],
  description: 'Compaction encrypted_content (+ usage) on success; { isError, message } on failure.',
} as unknown as JSONSchemaType<ModelCompactOutput>

// ---------------------------------------------------------------------------
// Response schema — composed from the open-responses schemas (no parallel
// schema source). additionalProperties: true at the top level tolerates
// provider extras on the ResponseResource envelope; output items stay strict.
// ---------------------------------------------------------------------------

type ResponseResource = {
  id: string
  object: string
  status: string
  output: OutputItem[]
  usage?: Usage
  error?: OpenResponsesError | null
}

const responseResourceJsonSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    object: { type: 'string' },
    status: { type: 'string' },
    model: { type: 'string' },
    output: { type: 'array', items: outputItemJsonSchema },
    usage: { ...usageJsonSchema, nullable: true },
    error: { ...errorJsonSchema, nullable: true },
  },
  required: ['id', 'object', 'status', 'output'],
  additionalProperties: true,
}

const validateResponseResource = ajv.compile(responseResourceJsonSchema)

const parseResponseResource = (data: unknown): ResponseResource | undefined => {
  if (!validateResponseResource(data)) return undefined
  return data as ResponseResource
}

// Compact resource — lax envelope (spec: object 'response.compaction', output
// items, usage); the compaction item itself is located structurally below so
// provider extras on sibling items never fail the round-trip.
const compactResourceValidator = ajv.compile({
  type: 'object',
  properties: {
    id: { type: 'string' },
    object: { type: 'string' },
    output: { type: 'array', items: { type: 'object' } },
    usage: { ...usageJsonSchema, nullable: true },
  },
  required: ['id', 'object', 'output'],
  additionalProperties: true,
})

type CompactResource = { output: unknown[]; usage?: Usage }

const parseCompactResource = (data: unknown): CompactResource | undefined => {
  if (!compactResourceValidator(data)) return undefined
  return data as CompactResource
}

export const MODEL_RESPOND_TOOL_NAME = 'model-respond'
export const MODEL_COMPACT_TOOL_NAME = 'model-compact'

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export type ModelRespondTool = ReturnType<typeof useTool<ModelRespondInput, ModelRespondOutput>>
export type ModelCompactTool = ReturnType<typeof useTool<ModelCompactInput, ModelCompactOutput>>

/**
 * Build the provisioned model tools bound to injected endpoint config.
 * `endpoints` maps provider labels to endpoint config whose `apiKey` was
 * already resolved from the keychain at provisioning time.
 */
export const createModelTools = ({
  endpoints,
}: {
  endpoints: ModelEndpoints
}): { modelRespond: ModelRespondTool; modelCompact: ModelCompactTool } => {
  const modelRespond = useTool(
    {
      name: MODEL_RESPOND_TOOL_NAME,
      description:
        'Send input items to an Open Responses endpoint. Returns output items (message, ' +
        'function_call, …) plus status and usage. function_call items are data only — the ' +
        'caller dispatches them.',
      inputSchema: ModelRespondInputSchema,
      outputSchema: ModelRespondOutputSchema,
    },
    async (input, validate): Promise<ModelRespondOutput> => {
      if (!validate.input(input)) {
        return {
          isError: true,
          message: `invalid input: ${validate.input.errors?.map((e) => `${e.instancePath} ${e.message}`).join('; ')}`,
        }
      }
      const endpoint = endpoints[input.provider]
      if (!endpoint) {
        return { isError: true, message: `[Error: unknown provider "${input.provider}"]` }
      }
      try {
        const res = await fetch(joinUrl(endpoint.url, '/v1/responses'), {
          method: 'POST',
          headers: buildHeaders(endpoint),
          body: JSON.stringify(buildRespondBody(input)),
        })
        if (!res.ok) return { isError: true, message: await describeHttpError(res) }
        if (input.stream === true && (res.headers.get('content-type') ?? '').includes('text/event-stream')) {
          return consumeSseStream(await res.text())
        }
        const parsed = parseResponseResource(await res.json())
        if (!parsed) return { isError: true, message: 'invalid response resource from endpoint' }
        return {
          items: parsed.output,
          status: parsed.status,
          ...(parsed.usage !== undefined && { usage: parsed.usage }),
          ...(parsed.error != null && { error: parsed.error }),
        }
      } catch (error) {
        return { isError: true, message: error instanceof Error ? error.message : String(error) }
      }
    },
  )

  const modelCompact = useTool(
    {
      name: MODEL_COMPACT_TOOL_NAME,
      description:
        'Compact a conversation via the endpoint /v1/responses/compact. Returns encrypted_content ' +
        'to pass back as a compaction input item on the next respond call.',
      inputSchema: ModelCompactInputSchema,
      outputSchema: ModelCompactOutputSchema,
    },
    async (input, validate): Promise<ModelCompactOutput> => {
      if (!validate.input(input)) {
        return {
          isError: true,
          message: `invalid input: ${validate.input.errors?.map((e) => `${e.instancePath} ${e.message}`).join('; ')}`,
        }
      }
      const endpoint = endpoints[input.provider]
      if (!endpoint) {
        return { isError: true, message: `[Error: unknown provider "${input.provider}"]` }
      }
      try {
        const body: Record<string, unknown> = { model: input.modelId, input: input.input }
        if (input.promptCacheKey !== undefined) body.prompt_cache_key = input.promptCacheKey
        const res = await fetch(joinUrl(endpoint.url, '/v1/responses/compact'), {
          method: 'POST',
          headers: buildHeaders(endpoint),
          body: JSON.stringify(body),
        })
        if (!res.ok) return { isError: true, message: await describeHttpError(res) }
        const parsed = parseCompactResource(await res.json())
        if (!parsed) return { isError: true, message: 'invalid compact response from endpoint' }
        const compaction = parsed.output.find((item) => (item as { type?: unknown }).type === 'compaction') as
          | { encrypted_content?: unknown }
          | undefined
        if (typeof compaction?.encrypted_content !== 'string') {
          return { isError: true, message: 'no compaction item with encrypted_content in response' }
        }
        return {
          encrypted_content: compaction.encrypted_content,
          ...(parsed.usage !== undefined && { usage: parsed.usage }),
        }
      } catch (error) {
        return { isError: true, message: error instanceof Error ? error.message : String(error) }
      }
    },
  )

  return { modelRespond, modelCompact }
}
