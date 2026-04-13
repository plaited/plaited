/** @internal Utilities for behavioral programming type guards and thread composition. */
import * as z from 'zod'
import { isTypeOf, ueid } from '../utils.ts'
import {
  EXTENSION_MEMORY_EVENTS,
  EXTENSION_REQUEST_EVENT,
  RULES_FUNCTION_IDENTIFIER,
  SNAPSHOT_MESSAGE_KINDS,
} from './behavioral.constants.ts'
import { notSchema } from './behavioral.shared.ts'
import type {
  AddBThread,
  BPEvent,
  BPListener,
  BSync,
  BThread,
  DefaultHandlers,
  ReportSnapshot,
  Trigger,
  UseSnapshot,
} from './behavioral.types.ts'
/**
 * Type guard to check if an unknown value conforms to the `BPEvent` structure.
 * Verifies if the value is an object with a `type` property that is a string.
 * This is useful for runtime validation of events, especially when receiving data
 * from external sources or when working with dynamically typed values.
 *
 * @param data - Value to check against the `BPEvent` structure.
 * @returns `true` if the value is a valid `BPEvent`, `false` otherwise.
 *
 * @see {@link BPEvent} for the structure being validated
 */
export const isBPEvent = (data: unknown): data is BPEvent => {
  return (
    isTypeOf<{ [key: string]: unknown }>(data, 'object') &&
    Object.hasOwn(data, 'type') &&
    isTypeOf<string>(data.type, 'string')
  )
}

type ExtensionParams = {
  memory: {
    has: (key: string) => boolean
    get: (key: string) => ContextMemoryEntry | undefined
  }
  extensions: {
    has: (key: string) => boolean
    get: CreateMemoryRequest
    request: CreateExtensionRequest
    block: CreateExtensionBlock
    subscribe: CreateMemorySubscribe
    subsciribe: CreateMemorySubscribe
  }
  bSync: BSync
  bThread: BThread
  trigger: Trigger
  useSnapshot: UseSnapshot
  DEFAULT_EVENTS: {
    readonly memory_disconnect: `${string}:${(typeof EXTENSION_MEMORY_EVENTS)['memory_disconnect']}`
    readonly memory_request: `${string}:${(typeof EXTENSION_MEMORY_EVENTS)['memory_request']}`
    readonly memory_response: `${string}:${(typeof EXTENSION_MEMORY_EVENTS)['memory_response']}`
    readonly memory_subscribe: `${string}:${(typeof EXTENSION_MEMORY_EVENTS)['memory_subscribe']}`
    readonly [EXTENSION_REQUEST_EVENT]: `${string}:${typeof EXTENSION_REQUEST_EVENT}`
  }
}

type Extension = {
  (params: ExtensionParams): DefaultHandlers
  id: string
  $: typeof RULES_FUNCTION_IDENTIFIER
}

type UseInstaller = {
  reportSnapshot: ReportSnapshot
  trigger: Trigger
  useSnapshot: UseSnapshot
  addBThread: AddBThread
  ttlMs: number
  maxKeys?: number
}

type ContextMemoryEntry = {
  body: unknown
  expiresAt: number
  createdAt: number
}

type ContextMemoryResponse = {
  id: string
  body: unknown
  expiresAt: number
  createdAt: number
}

type MemoryRequestEvent = {
  type: `${string}:${(typeof EXTENSION_MEMORY_EVENTS)['memory_request']}`
  detail: {
    id: string
    extension: string
    event: string
    purpose?: string
  }
}

type MemoryRequestRef = {
  requestEvent: MemoryRequestEvent
  transactionListener: BPListener
  transactionEventType: string
}
type CreateMemoryRequest = (params: {
  extension: string
  event: string
  purpose?: string
  detailSchema: z.ZodType
}) => MemoryRequestRef

type ExtensionRequestEvent = {
  type: `${string}:${typeof EXTENSION_REQUEST_EVENT}`
  detail: {
    id: string
    extension: string
    type: string
    detail: unknown
    purpose?: string
    listener: BPListener
  }
}

type ExtensionRequestRef = {
  requestEvent: ExtensionRequestEvent
  transactionListener: BPListener
  transactionEventType: string
}
type CreateExtensionRequest = (
  params: {
    extension: string
    event: string
    purpose?: string
    detailSchema: z.ZodType
  } & BPEvent,
) => ExtensionRequestRef

type MemorySubscribeEvent = {
  type: `${string}:${(typeof EXTENSION_MEMORY_EVENTS)['memory_subscribe']}`
  detail: {
    id: string
    extension: string
    listener: BPListener
    purpose?: string
  }
}

type MemoryDisconnectEvent = {
  type: `${string}:${(typeof EXTENSION_MEMORY_EVENTS)['memory_disconnect']}__${string}`
}

type MemorySubscribeRef = {
  disconnectEvent: MemoryDisconnectEvent
  transactionEventType: string
  transactionListener: BPListener
  subscribeEvent: MemorySubscribeEvent
}

type CreateMemorySubscribe = (params: {
  extension: string
  event: string
  purpose?: string
  detailSchema: z.ZodType
}) => MemorySubscribeRef

type CreateExtensionBlock = (params: { extension: string; event: string; detailSchema: z.ZodType }) => BPListener

const sync: BSync = (syncPoint) =>
  function* () {
    yield syncPoint
  }

export const useInstaller = ({ reportSnapshot, trigger, useSnapshot, addBThread, ttlMs, maxKeys }: UseInstaller) => {
  const BExtensions = new Set<string>()
  return (extension: Extension): DefaultHandlers => {
    const SCOPE_BYPASS_MARKER: unique symbol = Symbol('plaited.scope_bypass')
    type ScopeBypassListener = BPListener & { [SCOPE_BYPASS_MARKER]: true }

    try {
      if (extension?.$ !== RULES_FUNCTION_IDENTIFIER) {
        const receivedBrand = (extension as { $?: unknown } | undefined)?.$
        throw new Error(
          `Invalid module: expected module.$ to equal "${RULES_FUNCTION_IDENTIFIER}", received ${String(receivedBrand)}.`,
        )
      }
      if (!isTypeOf<string>(extension?.id, 'string')) {
        const receivedId = (extension as { id?: unknown } | undefined)?.id
        throw new Error(
          `Invalid module: expected module.id to be a string, received ${String(receivedId)} (${typeof receivedId}).`,
        )
      }
      if (BExtensions.has(extension?.id)) {
        throw new Error(
          `Duplicate module id "${extension.id}" detected during install. Module ids must be unique per installer instance.`,
        )
      }

      const extensionId = extension.id
      BExtensions.add(extensionId)

      const contextMemory = new Map<string, ContextMemoryEntry>()

      const pruneExpiredMemory = () => {
        const now = Date.now()
        for (const [key, entry] of contextMemory) {
          if (entry.expiresAt <= now) {
            contextMemory.delete(key)
          }
        }
      }

      const enforceMaxKeys = () => {
        if (maxKeys === undefined || maxKeys <= 0) {
          return
        }
        while (contextMemory.size > maxKeys) {
          const oldestKey = contextMemory.keys().next().value
          if (!oldestKey) {
            break
          }
          contextMemory.delete(oldestKey)
        }
      }

      useSnapshot((snapshot) => {
        if (snapshot.kind === SNAPSHOT_MESSAGE_KINDS.selection) {
          const selected = snapshot.bids.find((bid) => bid.selected)
          if (selected) {
            const { type, detail } = selected
            pruneExpiredMemory()
            contextMemory.delete(type)
            contextMemory.set(type, {
              createdAt: Date.now(),
              expiresAt: Date.now() + ttlMs,
              body: detail,
            })
            enforceMaxKeys()
          }
        }
      })

      const TRANSACTION_PREFIX = `${extensionId}:${EXTENSION_MEMORY_EVENTS.memory_transaction}`
      const DEFAULT_EVENTS: ExtensionParams['DEFAULT_EVENTS'] = {
        memory_disconnect: `${extensionId}:${EXTENSION_MEMORY_EVENTS.memory_disconnect}`,
        memory_request: `${extensionId}:${EXTENSION_MEMORY_EVENTS.memory_request}`,
        memory_response: `${extensionId}:${EXTENSION_MEMORY_EVENTS.memory_response}`,
        memory_subscribe: `${extensionId}:${EXTENSION_MEMORY_EVENTS.memory_subscribe}`,
        [EXTENSION_REQUEST_EVENT]: `${extensionId}:${EXTENSION_REQUEST_EVENT}`,
      }

      const createMemoryRequest: CreateMemoryRequest = ({ extension, purpose, detailSchema, event }) => {
        const id = ueid('mem_')
        const transactionEventType = `${extensionId}:${EXTENSION_MEMORY_EVENTS.memory_transaction}__${id}`

        const requestEvent: MemoryRequestEvent = {
          type: `${extension}:${EXTENSION_MEMORY_EVENTS.memory_request}`,
          detail: {
            id,
            extension: extensionId,
            event,
            purpose,
          },
        }

        const blockListener: BPListener = {
          type: DEFAULT_EVENTS.memory_response,
          detailSchema: z.object({
            id: z.literal(id),
            expiresAt: z.number().optional(),
            createdAt: z.number(),
            body: notSchema(detailSchema),
          }),
        }

        const transactionListener: BPListener = {
          type: DEFAULT_EVENTS.memory_response,
          detailSchema: z.object({
            id: z.literal(id),
            expiresAt: z.number().optional(),
            createdAt: z.number(),
            body: detailSchema,
          }),
        }

        bThread({
          label: transactionEventType,
          rules: [
            sync({
              block: blockListener,
              interrupt: transactionListener,
            }),
          ],
          repeat: true,
        })

        return {
          requestEvent,
          transactionListener,
          transactionEventType,
        }
      }

      const createExtensionRequest: CreateExtensionRequest = ({ extension, type, purpose, detailSchema, detail }) => {
        const id = ueid('mem_')
        const transactionEventType = `${extensionId}:${EXTENSION_MEMORY_EVENTS.memory_transaction}__${id}`

        const extensionListener: BPListener = {
          type: `${extension}:${type}`,
          detailSchema: z.object({
            expiresAt: z.number().optional(),
            createdAt: z.number(),
            body: detailSchema,
          }),
        }

        const requestEvent: ExtensionRequestEvent = {
          type: `${extension}:${EXTENSION_REQUEST_EVENT}`,
          detail: {
            id,
            extension: extensionId,
            type,
            detail,
            purpose,
            listener: extensionListener,
          },
        }

        const transactionListener: BPListener = {
          type: DEFAULT_EVENTS.memory_response,
          detailSchema: z.object({
            id: z.literal(id),
            expiresAt: z.number().optional(),
            createdAt: z.number(),
            body: detailSchema,
          }),
        }

        return {
          requestEvent,
          transactionListener,
          transactionEventType,
        }
      }

      const createMemorySubscriber: CreateMemorySubscribe = ({ extension, event, purpose, detailSchema }) => {
        const id = ueid('mem_')
        const transactionEventType = `${extensionId}:${EXTENSION_MEMORY_EVENTS.memory_transaction}__${id}`

        const extensionListener: BPListener = {
          type: `${extension}:${event}`,
          detailSchema: z.object({
            expiresAt: z.number().optional(),
            createdAt: z.number(),
            body: detailSchema,
          }),
        }

        const transactionListener: BPListener = {
          type: transactionEventType,
          detailSchema: z.object({
            id: z.literal(id),
            expiresAt: z.number().optional(),
            createdAt: z.number(),
            body: detailSchema,
          }),
        }

        const subscribeEvent: MemorySubscribeEvent = {
          type: `${extension}:${EXTENSION_MEMORY_EVENTS.memory_subscribe}`,
          detail: {
            id,
            extension,
            listener: extensionListener,
            purpose,
          },
        }

        const disconnectEvent: MemoryDisconnectEvent = {
          type: `${DEFAULT_EVENTS.memory_disconnect}__${id}`,
        }

        return {
          subscribeEvent,
          disconnectEvent,
          transactionListener,
          transactionEventType,
        }
      }

      const createExtensionBlock: CreateExtensionBlock = ({ extension, event, detailSchema }) => {
        return {
          type: `${extension}:${event}`,
          detailSchema,
          [SCOPE_BYPASS_MARKER]: true,
        } satisfies ScopeBypassListener
      }

      const memory = {
        has: (key: string) => contextMemory.has(key),
        get: (key: string) => contextMemory.get(key),
      }

      const extensions = {
        has: (key: string) => BExtensions.has(key),
        get: createMemoryRequest,
        request: createExtensionRequest,
        block: createExtensionBlock,
        subscribe: createMemorySubscriber,
        subsciribe: createMemorySubscriber,
      }

      const bThread: BThread = ({ label, rules, repeat }) => {
        const shouldRepeat = repeat === true
        const thread = Object.assign(
          shouldRepeat
            ? function* () {
                while (shouldRepeat) {
                  const length = rules.length
                  for (let i = 0; i < length; i++) {
                    yield* rules[i]!()
                  }
                }
              }
            : function* () {
                const length = rules.length
                for (let i = 0; i < length; i++) {
                  yield* rules[i]!()
                }
              },
        )
        return addBThread(label, thread)
      }

      const toScopedType = (type: string) => (type.includes(':') ? type : `${extensionId}:${type}`)
      const hasScopeBypass = (listener: BPListener): listener is ScopeBypassListener =>
        (listener as ScopeBypassListener)[SCOPE_BYPASS_MARKER] === true
      const toScopedListener = (listener: BPListener): BPListener => ({
        ...(hasScopeBypass(listener) ? listener : { ...listener, type: toScopedType(listener.type) }),
      })
      const toScopedListeners = (listener?: BPListener | BPListener[]) => {
        if (!listener) {
          return listener
        }
        return Array.isArray(listener) ? listener.map(toScopedListener) : toScopedListener(listener)
      }

      const bSync: BSync = ({ request, ...rest }) =>
        Object.assign(function* () {
          const scopedRest = {
            ...rest,
            ...(rest.waitFor && { waitFor: toScopedListeners(rest.waitFor) }),
            ...(rest.block && { block: toScopedListeners(rest.block) }),
            ...(rest.interrupt && { interrupt: toScopedListeners(rest.interrupt) }),
          }
          if (!request) {
            yield scopedRest
            return
          }
          yield Object.assign(scopedRest, {
            request: {
              type: toScopedType(request.type),
              detail: request.detail,
            },
          })
        })

      const handlers = extension({
        useSnapshot,
        bThread,
        bSync,
        trigger,
        DEFAULT_EVENTS,
        memory,
        extensions,
      })

      const mappedHandlers: DefaultHandlers = {}
      for (const [key, handler] of Object.entries(handlers)) {
        mappedHandlers[`${extensionId}:${key}`] = handler
      }

      return {
        ...mappedHandlers,
        [DEFAULT_EVENTS[EXTENSION_REQUEST_EVENT]]({
          id,
          type,
          detail,
          extension,
          listener,
        }: ExtensionRequestEvent['detail']) {
          bThread({
            label: `${extension}:${EXTENSION_REQUEST_EVENT}__${id}`,
            rules: [
              sync({
                waitFor: listener,
              }),
              sync({
                request: {
                  type: DEFAULT_EVENTS.memory_request,
                  detail: {
                    id,
                    event: listener.type,
                    extension,
                  },
                },
              }),
            ],
          })
          trigger({
            type: toScopedType(type),
            detail,
          })
        },
        [DEFAULT_EVENTS.memory_subscribe]({ id, listener, extension }: MemorySubscribeEvent['detail']) {
          bThread({
            label: `${extension}:${EXTENSION_MEMORY_EVENTS.memory_subscribe}__${id}`,
            rules: [
              sync({
                waitFor: listener,
                interrupt: {
                  type: `${extension}:${EXTENSION_MEMORY_EVENTS.memory_disconnect}__${id}`,
                  detailSchema: z.undefined(),
                },
              }),
              sync({
                request: {
                  type: DEFAULT_EVENTS.memory_request,
                  detail: {
                    id,
                    event: listener.type,
                    extension,
                  },
                },
              }),
            ],
            repeat: true,
          })
        },
        [DEFAULT_EVENTS.memory_response]({ id, ...detail }: ContextMemoryResponse) {
          trigger({
            type: `${TRANSACTION_PREFIX}__${id}`,
            detail,
          })
        },
        [DEFAULT_EVENTS.memory_request]({ id, event, extension }: MemoryRequestEvent['detail']) {
          const entry = contextMemory.get(event)
          if (!entry) {
            throw new Error(
              `Unable to resolve "${event}" for request "${id}" in extension "${extensionId}": ` +
                `cannot send "${extension}:${EXTENSION_MEMORY_EVENTS.memory_response}" because ` +
                `memory entry "${extensionId}:${event}" does not exist.`,
            )
          }
          const detail: ContextMemoryResponse = {
            ...entry,
            id,
          }
          trigger({
            type: `${extension}:${EXTENSION_MEMORY_EVENTS.memory_response}`,
            detail,
          })
        },
      }
    } catch (error) {
      const message = {
        kind: SNAPSHOT_MESSAGE_KINDS.extension_error,
        error: error instanceof Error ? error.message : String(error),
      }
      isTypeOf<string>(extension?.id, 'string') && Object.assign(message, { id: extension.id })
      reportSnapshot(message)
      return {}
    }
  }
}
