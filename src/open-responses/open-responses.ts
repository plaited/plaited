import type { Behavioral } from '../behavioral/behavioral.types.ts'
import { sync, thread } from '../behavioral/behavioral.utils.ts'
import { OPEN_RESPONSES_EVENTS } from './open-responses.constants.ts'

/**
 * @public
 */
export type OpenResponsesTransport = 'http' | 'websocket'

/**
 * @public
 */
export type OpenResponsesClientConfig = {
  baseUrl: string
  apiKey: string
  model: string
  maxToolCalls?: number
  transport?: OpenResponsesTransport
  fetch?: typeof globalThis.fetch
  WebSocket?: typeof globalThis.WebSocket
}

type ZodJSONType = string | number | boolean | null | ZodJSONType[] | { [key: string]: ZodJSONType }
const DOT_TO_UNDERSCORE = /\./g

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const sseEventToBehavioral = (eventType: string) => eventType.replace(DOT_TO_UNDERSCORE, '_')

const processSseStream = async ({
  stream,
  onEvent,
}: {
  stream: ReadableStream<Uint8Array>
  onEvent: (eventType: string, data: unknown) => void
}) => {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent = ''

  const processLines = (text: string) => {
    for (const line of text.split('\n')) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim()
      } else if (line.startsWith('data: ')) {
        const dataStr = line.slice(6).trim()
        if (!dataStr || dataStr === '[DONE]') continue
        try {
          onEvent(currentEvent, JSON.parse(dataStr))
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''
      for (const part of parts) processLines(part)
    }
    if (buffer.trim()) processLines(buffer)
  } finally {
    reader.releaseLock()
  }
}

/* ------------------------------------------------------------------ */
/*  Factory                                                           */
/* ------------------------------------------------------------------ */

/**
 * Creates an Open Responses client wired into a Plaited behavioral program.
 *
 * @param runtime - The behavioral program instance (from {@link behavioral}).
 * @param config - Connection, model, and transport configuration.
 * @returns An interface with addHandler and trigger for Open Responses events.
 *
 * @public
 */
export const createOpenResponsesClient = (
  runtime: ReturnType<Behavioral>,
  config: OpenResponsesClientConfig,
): { addHandler: typeof runtime.addHandler; trigger: typeof runtime.trigger } => {
  const { addHandler, addThread, trigger } = runtime
  const apiFetch = config.fetch ?? globalThis.fetch
  const WsCtor = config.WebSocket ?? globalThis.WebSocket
  const maxToolCalls = config.maxToolCalls ?? 25
  const transportMode = config.transport ?? 'http'
  const responsesUrl = `${config.baseUrl.replace(/\/$/, '')}/responses`

  /* ---- Conversation state (private, closure-scoped) ---- */

  let currentInputItems: unknown[] = []
  let currentTools: unknown[] = []
  let toolCallCount = 0
  /** Parallel tool-call tracking: call_id → { name, arguments }. */
  const pendingFunctionCalls = new Map<string, { name: string; arguments: string }>()
  let accumulatedArguments = ''

  /* ---- Detail cast helper ---- */

  const asDetail = (value: unknown): Record<string, ZodJSONType> => value as Record<string, ZodJSONType>

  /* ---------------------------------------------------------------- */
  /*  Internal: capture handlers for SSE event aggregation            */
  /* ---------------------------------------------------------------- */

  addHandler(OPEN_RESPONSES_EVENTS.response_function_call_arguments_delta, (detail) => {
    const d = detail as unknown as { delta?: string }
    if (typeof d.delta === 'string') accumulatedArguments += d.delta
  })

  addHandler(OPEN_RESPONSES_EVENTS.response_function_call_arguments_done, (detail) => {
    const d = detail as unknown as { call_id?: string; name?: string; arguments?: string }
    if (typeof d.call_id === 'string') {
      pendingFunctionCalls.set(d.call_id, {
        name: d.name ?? '',
        arguments: d.arguments ?? accumulatedArguments,
      })
      accumulatedArguments = ''
    }
  })

  /* ---------------------------------------------------------------- */
  /*  Helper: convert provider events → behavioral events             */
  /* ---------------------------------------------------------------- */

  const convertProviderEvent = (eventType: string, data: unknown) => {
    // Suppress response.completed while a pending tool call is waiting.
    if (eventType === 'response.completed' && pendingFunctionCalls.size > 0) return
    trigger({ type: sseEventToBehavioral(eventType), detail: asDetail(data) })
  }

  /* ---------------------------------------------------------------- */
  /*  HTTP transport                                                  */
  /* ---------------------------------------------------------------- */

  const doHttpPost = async (body: unknown) => {
    try {
      const response = await apiFetch(responsesUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
          Accept: 'text/event-stream, application/json',
        },
        body: JSON.stringify(body),
      })

      const contentType = response.headers.get('content-type') ?? ''

      if (!response.ok) {
        // Prefer reading the response body as text to avoid losing non-JSON errors.
        let errorBody: string
        try {
          errorBody = await response.text()
        } catch {
          errorBody = String(response.status)
        }
        trigger({
          type: OPEN_RESPONSES_EVENTS.response_failed,
          detail: asDetail({ error: errorBody, status: response.status }),
        })
        return
      }

      if (contentType.includes('text/event-stream') && response.body) {
        await processSseStream({ stream: response.body, onEvent: convertProviderEvent })
      } else {
        trigger({ type: OPEN_RESPONSES_EVENTS.response_completed, detail: asDetail(await response.json()) })
      }
    } catch (error) {
      trigger({ type: OPEN_RESPONSES_EVENTS.response_failed, detail: asDetail({ error: String(error) }) })
    }
  }

  /* ---------------------------------------------------------------- */
  /*  WebSocket transport                                             */
  /* ---------------------------------------------------------------- */

  type WsSocket = { send: (data: string) => void; close: () => void; readyState: number } | null

  let wsSocket: WsSocket = null
  const wsPendingMessages: string[] = []
  let wsFailed = false

  const getWsUrl = (httpUrl: string) => httpUrl.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://')

  const openWebSocket = (): Promise<WsSocket> => {
    if (wsSocket) return Promise.resolve(wsSocket)
    if (wsFailed) {
      trigger({
        type: OPEN_RESPONSES_EVENTS.response_failed,
        detail: asDetail({ error: 'WebSocket previously failed' }),
      })
      return Promise.resolve(null)
    }
    if (!WsCtor) {
      trigger({ type: OPEN_RESPONSES_EVENTS.response_failed, detail: asDetail({ error: 'WebSocket not available' }) })
      return Promise.resolve(null)
    }

    return new Promise((resolve) => {
      try {
        const ws = new WsCtor(getWsUrl(responsesUrl))

        ws.onopen = () => {
          wsSocket = ws as unknown as WsSocket
          const socket = wsSocket
          if (socket) {
            while (wsPendingMessages.length > 0) {
              socket.send(wsPendingMessages.shift()!)
            }
          }
          resolve(wsSocket)
        }

        ws.onmessage = (event: { data: string }) => {
          try {
            const data = JSON.parse(event.data) as Record<string, unknown>
            const type = typeof data.type === 'string' ? data.type : ''
            if (type.startsWith('response.')) {
              convertProviderEvent(type, data)
            }
            if (type === 'error') {
              trigger({ type: OPEN_RESPONSES_EVENTS.response_failed, detail: asDetail(data) })
            }
          } catch {
            // Skip malformed WebSocket message
          }
        }

        ws.onerror = () => {
          if (wsFailed) return // prevent double-fire from error + close
          wsFailed = true
          trigger({
            type: OPEN_RESPONSES_EVENTS.response_failed,
            detail: asDetail({ error: 'WebSocket connection error' }),
          })
          wsSocket = null
          wsPendingMessages.length = 0 // drain queue – no connection to send on
          resolve(null)
        }

        ws.onclose = () => {
          wsSocket = null
        }
      } catch (error) {
        trigger({ type: OPEN_RESPONSES_EVENTS.response_failed, detail: asDetail({ error: String(error) }) })
        resolve(null)
      }
    })
  }

  const sendWebSocket = async (body: Record<string, unknown>) => {
    const socket = await openWebSocket()
    if (!socket) {
      // Connection didn't open – do not queue
      return
    }
    const message = JSON.stringify(body)
    if (socket.readyState === 1) {
      socket.send(message)
    } else {
      wsPendingMessages.push(message)
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Transport dispatch                                              */
  /* ---------------------------------------------------------------- */

  const sendCreate = async (body: unknown) => {
    if (transportMode === 'websocket') {
      const detailObj = body as Record<string, unknown>
      const wsBody: Record<string, unknown> = { type: 'response.create', ...detailObj }
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete wsBody.stream
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete wsBody.stream_options
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete wsBody.background
      await sendWebSocket(wsBody)
    } else {
      await doHttpPost(body)
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Public handlers                                                  */
  /* ---------------------------------------------------------------- */

  addHandler(OPEN_RESPONSES_EVENTS.response_create, async (detail) => {
    const d = detail as unknown as { input?: unknown; tools?: unknown } | undefined
    currentInputItems = Array.isArray(d?.input) ? d.input : typeof d?.input === 'string' ? [d.input] : []
    currentTools = Array.isArray(d?.tools) ? d.tools : []
    toolCallCount = 0
    pendingFunctionCalls.clear()
    accumulatedArguments = ''

    await sendCreate({ model: config.model, ...(d ?? {}) })
  })

  addHandler(OPEN_RESPONSES_EVENTS.tool_result, async (detail) => {
    const d = detail as unknown as { call_id?: string; output?: string }
    const call_id = typeof d.call_id === 'string' ? d.call_id : ''
    if (!call_id) {
      trigger({
        type: OPEN_RESPONSES_EVENTS.response_failed,
        detail: asDetail({ error: 'tool_result missing call_id' }),
      })
      return
    }

    const pending = pendingFunctionCalls.get(call_id)
    if (!pending) {
      trigger({
        type: OPEN_RESPONSES_EVENTS.response_failed,
        detail: asDetail({ error: `unknown call_id: ${call_id}` }),
      })
      return
    }

    const output = typeof d.output === 'string' ? d.output : ''
    toolCallCount++

    // Max tool calls exceeded: block without accumulating into input
    if (maxToolCalls > 0 && toolCallCount >= maxToolCalls) {
      pendingFunctionCalls.delete(call_id)
      trigger({
        type: OPEN_RESPONSES_EVENTS.response_failed,
        detail: asDetail({ reason: 'max_tool_calls_exceeded', maxToolCalls }),
      })
      return
    }

    // Append function_call + tool output
    currentInputItems = [
      ...currentInputItems,
      {
        type: 'function_call',
        id: call_id,
        call_id,
        name: pending.name,
        arguments: pending.arguments,
        status: 'completed',
      },
      {
        type: 'function_call_output',
        call_id,
        output,
        status: 'completed',
      },
    ]
    pendingFunctionCalls.delete(call_id)

    // Only resubmit when ALL pending tool calls are resolved.
    if (pendingFunctionCalls.size > 0) return

    await sendCreate({ model: config.model, input: currentInputItems, tools: currentTools })
  })

  /* ---------------------------------------------------------------- */
  /*  Behavioral threads                                              */
  /* ---------------------------------------------------------------- */

  addThread(
    'tool_loop',
    thread([
      sync({
        waitFor: [{ type: OPEN_RESPONSES_EVENTS.response_function_call_arguments_done }],
        interrupt: [
          { type: OPEN_RESPONSES_EVENTS.response_completed },
          { type: OPEN_RESPONSES_EVENTS.response_failed },
          { type: OPEN_RESPONSES_EVENTS.response_incomplete },
        ],
      }),
      sync({
        waitFor: [{ type: OPEN_RESPONSES_EVENTS.tool_result }],
        interrupt: [
          { type: OPEN_RESPONSES_EVENTS.response_failed },
          { type: OPEN_RESPONSES_EVENTS.response_incomplete },
        ],
      }),
    ]),
  )

  return { addHandler, trigger }
}
