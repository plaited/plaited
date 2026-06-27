import { A2A_METHODS, WEB_A2A_EXTENSION_URI } from '../shared/shared.constants.ts'
import {
  type JsonObject,
  type JsonRpcRequest,
  JsonRpcRequestSchema,
  type JsonRpcResponse,
  JsonRpcResponseSchema,
} from '../shared/shared.schemas.ts'
import { ueid } from '../utils.ts'

/**
 * Minimal AgentCard shape needed for web-a2a capability negotiation.
 *
 * @remarks
 * Envelope-only validation client-side; the full A2A AgentCard schema is a
 * server-side concern. We only need `capabilities.extensions` to confirm mutual
 * web-a2a support.
 *
 * @public
 */
export type WebA2aAgentCard = {
  name?: string
  version?: string
  url?: string
  capabilities?: {
    extensions?: Array<{ uri: string; description?: string; required?: boolean }>
  }
}

/**
 * A2A JSON-RPC method handler on the provider side.
 *
 * @public
 */
export type A2aHandler = (params: Record<string, unknown>) => unknown | Promise<unknown>

/** @public */
export type A2aHandlers = Partial<Record<A2AMethodName, A2aHandler>>

type A2AMethodName = (typeof A2A_METHODS)[keyof typeof A2A_METHODS]

/** @public */
export interface ExposeArgs {
  /** The provider's own `window` (listens for the handshake). */
  window: PostMessageEndpoint
  /** The provider's AgentCard (must declare the web-a2a extension). */
  agentCard: WebA2aAgentCard
  /** Origins allowed to connect. Defaults to `['*']` (public API). */
  allowedOrigins?: (string | RegExp)[]
  /** A2A method handlers invoked once migrated to the private `MessagePort`. */
  handlers: A2aHandlers
  /** Optional hook invoked when the handshake arrives (testing/diagnostics). */
  onHandshake?: (ev: MessageEvent) => void
}

/** @public */
export interface PostMessageEndpoint {
  postMessage(message: unknown, targetOrigin: string, transfer?: Transferable[]): void
  addEventListener(type: 'message', listener: (ev: MessageEvent) => void): void
  removeEventListener(type: 'message', listener: (ev: MessageEvent) => void): void
}

const isAllowedOrigin = (allowedOrigins: (string | RegExp)[], origin: string): boolean => {
  for (const allowed of allowedOrigins) {
    if (allowed === '*' || allowed === origin) return true
    if (allowed instanceof RegExp && allowed.test(origin)) return true
  }
  return false
}

const hasWebA2aExtension = (card: WebA2aAgentCard | undefined): boolean =>
  !!card?.capabilities?.extensions?.some((e) => e.uri === WEB_A2A_EXTENSION_URI)

/**
 * Expose an A2A agent over a `postMessage` window boundary.
 *
 * @remarks
 * Listens for the consumer's `GetExtendedAgentCard` handshake, verifies mutual
 * web-a2a extension support, accepts the transferred `MessagePort`, and serves
 * all subsequent A2A RPC over that private port. Mirrors Comlink's `expose` but
 * restricts the handshake to a real A2A call and migrates to a `MessagePort`.
 */
export const expose = ({
  window: ep,
  agentCard,
  allowedOrigins = ['*'],
  handlers,
  onHandshake,
}: ExposeArgs): (() => void) => {
  const listener = (ev: MessageEvent) => {
    if (!ev?.data) return
    if (!isAllowedOrigin(allowedOrigins, ev.origin)) return
    onHandshake?.(ev)

    let request: JsonRpcRequest
    try {
      request = JsonRpcRequestSchema.parse(ev.data)
    } catch {
      return // not a JSON-RPC request; ignore
    }
    if (request.method !== A2A_METHODS.GetExtendedAgentCard) return

    const clientCard = (request.params as { clientAgentCard?: WebA2aAgentCard } | undefined)?.clientAgentCard
    const port = ev.ports[0]
    // mutual declaration: both sides must declare the web-a2a extension.
    // If we have a port but refuse, reply with an error over it so the
    // consumer rejects cleanly instead of hanging forever.
    if (!hasWebA2aExtension(clientCard) || !hasWebA2aExtension(agentCard)) {
      port?.start()
      port?.postMessage({
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32600, message: 'provider does not support the web-a2a extension' },
      })
      return
    }
    if (!port) return
    port.start()

    // respond to the handshake (the extended card) over the private port
    const response: JsonRpcResponse = { jsonrpc: '2.0', id: request.id, result: agentCard }
    port.postMessage(response)

    // serve subsequent A2A RPC over the private port
    port.addEventListener('message', (msg) => {
      void handleRequest(msg.data as JsonRpcRequest, handlers).then((res) => port.postMessage(res))
    })
  }
  ep.addEventListener('message', listener)
  return () => ep.removeEventListener('message', listener)
}

const handleRequest = async (request: JsonRpcRequest, handlers: A2aHandlers): Promise<JsonRpcResponse> => {
  const handler = handlers[request.method as A2AMethodName]
  if (!handler) {
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: { code: -32601, message: `Method not found: ${request.method}` },
    }
  }
  try {
    const result = await handler(request.params ?? {})
    return { jsonrpc: '2.0', id: request.id, result }
  } catch (err) {
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: { code: -32603, message: err instanceof Error ? err.message : 'Internal error' },
    }
  }
}

/** @public */
export interface UsePostMessageArgs {
  /** The remote window (e.g. the return value of `window.open`). */
  window: PostMessageEndpoint
  /** Origin the consumer expects the provider to be at (locks the handshake). */
  targetOrigin: string
  /** The consumer's AgentCard (must declare the web-a2a extension). */
  agentCard: WebA2aAgentCard
  /** Handshake timeout in ms. Defaults to 5000. */
  handshakeTimeoutMs?: number
}

/** @public */
export interface Remote {
  /** Invoke an A2A method over the migrated private `MessagePort`. */
  <T = unknown>(method: A2AMethodName, params?: JsonObject): Promise<T>
}

/** @public */
export interface PostMessageConnection {
  /** The provider's extended AgentCard, received over the private port. */
  extendedCard: WebA2aAgentCard
  /** Proxy that turns calls into A2A JSON-RPC requests over the private port. */
  remote: Remote
  /** Tear down the private port. */
  release: () => void
}

/**
 * Connect to a web-a2a provider by sending a `GetExtendedAgentCard` handshake
 * carrying a transferred `MessagePort`, then migrating all RPC to it.
 *
 * @remarks
 * Throws if the provider does not declare the web-a2a extension (no silent
 * fallback to perpetual `window.postMessage`).
 */
export const usePostMessage = ({
  window: ep,
  targetOrigin,
  agentCard,
  handshakeTimeoutMs = 5000,
}: UsePostMessageArgs): Promise<PostMessageConnection> => {
  if (!hasWebA2aExtension(agentCard)) {
    return Promise.reject(new Error('consumer AgentCard must declare the web-a2a extension'))
  }

  const { port1, port2 } = new MessageChannel()
  port1.start()

  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      port1.removeEventListener('message', onPortMessage)
      fn()
    }
    const onPortMessage = (ev: MessageEvent) => {
      let response: JsonRpcResponse
      try {
        response = JsonRpcResponseSchema.parse(ev.data)
      } catch {
        return
      }
      if (response.error) {
        const err = response.error
        finish(() => reject(new Error(err.message)))
        return
      }
      const extendedCard = response.result as WebA2aAgentCard
      if (!hasWebA2aExtension(extendedCard)) {
        finish(() => reject(new Error('provider AgentCard does not declare the web-a2a extension')))
        return
      }
      finish(() => resolve({ extendedCard, remote: createRemote(port1), release: () => port1.close() }))
    }
    port1.addEventListener('message', onPortMessage)

    // If the provider refuses without a port reply (e.g. disallowed origin
    // drops the message before reading it), the consumer must still reject.
    const timer = setTimeout(() => finish(() => reject(new Error('web-a2a handshake timed out'))), handshakeTimeoutMs)

    const handshake: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: ueid('a2a-'),
      method: A2A_METHODS.GetExtendedAgentCard,
      params: { clientAgentCard: agentCard },
    }
    // port2 travels to the provider; port1 stays local as the private pipe
    ep.postMessage(handshake, targetOrigin, [port2])
  })
}

const createRemote =
  (port: MessagePort): Remote =>
  <T = unknown>(method: A2AMethodName, params: JsonObject = {}) =>
    new Promise<T>((resolve, reject) => {
      const id = ueid('a2a-')
      const onMessage = (ev: MessageEvent) => {
        let response: JsonRpcResponse
        try {
          response = JsonRpcResponseSchema.parse(ev.data)
        } catch {
          return
        }
        if (response.id !== id) return
        port.removeEventListener('message', onMessage)
        if (response.error) reject(new Error(response.error.message))
        else resolve(response.result as T)
      }
      port.addEventListener('message', onMessage)
      const request: JsonRpcRequest = { jsonrpc: '2.0', id, method, params }
      port.postMessage(request)
    })
