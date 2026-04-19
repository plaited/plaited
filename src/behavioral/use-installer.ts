/** @internal Utilities for behavioral programming type guards and thread composition. */
import * as z from 'zod'
import { isTypeOf, ueid } from '../utils.ts'
import {
  EXTENSION_FUNCTION_IDENTIFIER,
  EXTENSION_MEMORY_EVENTS,
  EXTENSION_REQUEST_EVENT,
  SNAPSHOT_MESSAGE_KINDS,
} from './behavioral.constants.ts'
import { createMemoryEntryDetailSchema, createMemoryResponseDetailSchema } from './behavioral.schemas.ts'
import { bSync as _bsync, bThread as _bThread } from './behavioral.shared.ts'
import type {
  BPEvent,
  BPListener,
  BSync,
  ContextMemoryEntry,
  ContextMemoryResponse,
  CreateExtensionBlock,
  CreateExtensionRequest,
  CreateMemoryRequest,
  CreateMemorySubscribe,
  DefaultHandlers,
  Extension,
  ExtensionParams,
  ExtensionRequestEvent,
  MemoryDisconnectEvent,
  MemoryRequestEvent,
  MemorySubscribeEvent,
  UseInstallerParams,
} from './behavioral.types.ts'

export const useInstaller = ({
  reportSnapshot,
  trigger: hostTrigger,
  useSnapshot,
  addBThread,
  ttlMs,
  maxKeys,
}: UseInstallerParams) => {
  const BExtensions = new Set<string>()
  return (extension: Extension): DefaultHandlers => {
    const SCOPE_BYPASS_MARKER: unique symbol = Symbol('plaited.scope_bypass')
    type ScopeBypassValue = BPListener | BPEvent
    type ScopeBypassMarked<T extends ScopeBypassValue> = T & { [SCOPE_BYPASS_MARKER]: true }

    try {
      if (extension?.$ !== EXTENSION_FUNCTION_IDENTIFIER) {
        const receivedBrand = (extension as { $?: unknown } | undefined)?.$
        throw new Error(
          `Invalid module: expected module.$ to equal "${EXTENSION_FUNCTION_IDENTIFIER}", received ${String(receivedBrand)}.`,
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
      const toExtensionEventType = <TEvent extends string>({
        extension,
        event,
      }: {
        extension: string
        event: TEvent
      }) => `${extension}:${event}` as `${string}:${TEvent}`
      const createTransactionEventType = (id: string) => `${TRANSACTION_PREFIX}__${id}`
      const DEFAULT_EVENTS: ExtensionParams['DEFAULT_EVENTS'] = {
        memory_disconnect: `${extensionId}:${EXTENSION_MEMORY_EVENTS.memory_disconnect}`,
        memory_request: `${extensionId}:${EXTENSION_MEMORY_EVENTS.memory_request}`,
        memory_response: `${extensionId}:${EXTENSION_MEMORY_EVENTS.memory_response}`,
        memory_subscribe: `${extensionId}:${EXTENSION_MEMORY_EVENTS.memory_subscribe}`,
        [EXTENSION_REQUEST_EVENT]: `${extensionId}:${EXTENSION_REQUEST_EVENT}`,
      }
      const markScopeBypass = <T extends ScopeBypassValue>(value: T): ScopeBypassMarked<T> =>
        Object.assign(value, { [SCOPE_BYPASS_MARKER]: true as const }) as ScopeBypassMarked<T>
      const hasScopeBypass = <T extends ScopeBypassValue>(value: T): value is ScopeBypassMarked<T> =>
        (value as ScopeBypassMarked<T>)[SCOPE_BYPASS_MARKER] === true
      const toScopedType = (type: string, bypass?: boolean) => {
        if (bypass) {
          return type
        }
        return `${extensionId}:${type}`
      }
      const toScopedEvent = (event: BPEvent): BPEvent | undefined => {
        const scopedType = toScopedType(event.type, hasScopeBypass(event))
        return {
          ...event,
          type: scopedType,
        }
      }
      const toScopedListener = (listener: BPListener): BPListener | undefined => {
        const scopedType = toScopedType(listener.type, hasScopeBypass(listener))
        return {
          ...listener,
          type: scopedType,
        }
      }
      const toScopedListeners = (listener: BPListener | BPListener[] | undefined) => {
        if (!listener) {
          return undefined
        }
        if (!Array.isArray(listener)) {
          return toScopedListener(listener)
        }
        const scoped = listener
          .map((candidate) => toScopedListener(candidate))
          .filter((candidate): candidate is BPListener => Boolean(candidate))
        if (scoped.length === 0) {
          return undefined
        }
        return scoped
      }

      const createMemoryRequest: CreateMemoryRequest = ({ extension, purpose, detailSchema, event }) => {
        const id = ueid('mem_')
        const transactionEventType = createTransactionEventType(id)

        const requestEvent = markScopeBypass<MemoryRequestEvent>({
          type: toExtensionEventType({ extension, event: EXTENSION_MEMORY_EVENTS.memory_request }),
          detail: {
            id,
            extension: extensionId,
            event,
            purpose,
          },
        })

        const blockListener = markScopeBypass<BPListener>({
          type: DEFAULT_EVENTS.memory_response,
          detailSchema: createMemoryResponseDetailSchema({
            id,
            detailSchema,
          }),
          detailMatch: 'invalid',
        })

        const transactionListener = markScopeBypass<BPListener>({
          type: DEFAULT_EVENTS.memory_response,
          detailSchema: createMemoryResponseDetailSchema({
            id,
            detailSchema,
          }),
        })

        bThread({
          label: transactionEventType,
          rules: [
            _bsync({
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
        const transactionEventType = createTransactionEventType(id)
        const targetExtension = extension
        const sourceExtension = extensionId

        const extensionListener = markScopeBypass<BPListener>({
          type: toExtensionEventType({ extension: targetExtension, event: type }),
          detailSchema: createMemoryEntryDetailSchema(detailSchema),
        })

        const requestEvent = markScopeBypass<ExtensionRequestEvent>({
          type: toExtensionEventType({ extension: targetExtension, event: EXTENSION_REQUEST_EVENT }),
          detail: {
            id,
            extension: sourceExtension,
            type,
            detail,
            purpose,
            listener: extensionListener,
          },
        })

        const transactionListener = markScopeBypass<BPListener>({
          type: DEFAULT_EVENTS.memory_response,
          detailSchema: createMemoryResponseDetailSchema({
            id,
            detailSchema,
          }),
        })

        return {
          requestEvent,
          transactionListener,
          transactionEventType,
        }
      }

      const createMemorySubscriber: CreateMemorySubscribe = ({ extension, event, purpose, detailSchema }) => {
        const id = ueid('mem_')
        const transactionEventType = createTransactionEventType(id)

        const extensionListener = markScopeBypass<BPListener>({
          type: toExtensionEventType({ extension, event }),
          detailSchema: createMemoryEntryDetailSchema(detailSchema),
        })

        const transactionListener = markScopeBypass<BPListener>({
          type: transactionEventType,
          detailSchema: createMemoryResponseDetailSchema({
            id,
            detailSchema,
          }),
        })

        const subscribeEvent = markScopeBypass<MemorySubscribeEvent>({
          type: toExtensionEventType({ extension, event: EXTENSION_MEMORY_EVENTS.memory_subscribe }),
          detail: {
            id,
            extension,
            listener: extensionListener,
            purpose,
          },
        })

        const disconnectEvent = markScopeBypass<MemoryDisconnectEvent>({
          type: `${DEFAULT_EVENTS.memory_disconnect}__${id}`,
        })

        return {
          subscribeEvent,
          disconnectEvent,
          transactionListener,
          transactionEventType,
        }
      }

      const createExtensionBlock: CreateExtensionBlock = ({ extension, event, detailSchema }) => {
        return markScopeBypass({
          type: toExtensionEventType({ extension, event }),
          detailSchema,
        })
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

      const bThread: ExtensionParams['bThread'] = ({ label, rules, repeat }) => {
        const thread = _bThread(rules, repeat)
        return addBThread(label, thread)
      }

      const bSync: BSync = ({ request, waitFor, block, interrupt }) =>
        Object.assign(function* () {
          const scopedWaitFor = toScopedListeners(waitFor)
          const scopedBlock = toScopedListeners(block)
          const scopedInterrupt = toScopedListeners(interrupt)
          const scopedRest = {
            ...(scopedWaitFor && { waitFor: scopedWaitFor }),
            ...(scopedBlock && { block: scopedBlock }),
            ...(scopedInterrupt && { interrupt: scopedInterrupt }),
          }
          const scopedRequest = request ? toScopedEvent(request) : undefined
          yield scopedRequest
            ? {
                ...scopedRest,
                request: scopedRequest,
              }
            : scopedRest
        })
      const extensionTrigger: ExtensionParams['trigger'] = (event) => {
        const scopedEvent = toScopedEvent(event)
        if (!scopedEvent) {
          return
        }
        hostTrigger(scopedEvent)
      }

      const handlers = extension({
        useSnapshot,
        reportSnapshot,
        bThread,
        bSync,
        trigger: extensionTrigger,
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
          extension: sourceExtension,
          listener,
        }: ExtensionRequestEvent['detail']) {
          bThread({
            label: `${sourceExtension}:${EXTENSION_REQUEST_EVENT}__${id}`,
            rules: [
              _bsync({
                waitFor: listener,
              }),
              _bsync({
                request: {
                  type: DEFAULT_EVENTS.memory_request,
                  detail: {
                    id,
                    event: listener.type,
                    extension: sourceExtension,
                  },
                },
              }),
            ],
          })
          const scopedType = toScopedType(type)
          hostTrigger({
            type: scopedType,
            detail,
          })
        },
        [DEFAULT_EVENTS.memory_subscribe]({ id, listener, extension }: MemorySubscribeEvent['detail']) {
          bThread({
            label: `${extension}:${EXTENSION_MEMORY_EVENTS.memory_subscribe}__${id}`,
            rules: [
              _bsync({
                waitFor: listener,
                interrupt: {
                  type: `${toExtensionEventType({ extension, event: EXTENSION_MEMORY_EVENTS.memory_disconnect })}__${id}`,
                  detailSchema: z.undefined(),
                },
              }),
              _bsync({
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
          hostTrigger({
            type: createTransactionEventType(id),
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
          hostTrigger({
            type: toExtensionEventType({ extension, event: EXTENSION_MEMORY_EVENTS.memory_response }),
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
