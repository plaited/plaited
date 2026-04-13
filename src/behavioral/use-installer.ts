/** @internal Utilities for behavioral programming type guards and thread composition. */
import * as z from 'zod'
import { isTypeOf, ueid } from '../utils.ts'
import {
  EXTENSION_MEMORY_EVENTS,
  EXTENSION_REQUEST_EVENT,
  RULES_FUNCTION_IDENTIFIER,
  SNAPSHOT_MESSAGE_KINDS,
} from './behavioral.constants.ts'
import { createMemoryEntryDetailSchema, createMemoryResponseDetailSchema } from './behavioral.schemas.ts'
import { bSync as _bsync, bThread as _bThread, notSchema } from './behavioral.shared.ts'
import type {
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
  UseInstaller,
} from './behavioral.types.ts'

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

      const createMemoryRequest: CreateMemoryRequest = ({ extension, purpose, detailSchema, event }) => {
        const id = ueid('mem_')
        const transactionEventType = createTransactionEventType(id)

        const requestEvent: MemoryRequestEvent = {
          type: toExtensionEventType({ extension, event: EXTENSION_MEMORY_EVENTS.memory_request }),
          detail: {
            id,
            extension: extensionId,
            event,
            purpose,
          },
        }

        const blockListener: BPListener = {
          type: DEFAULT_EVENTS.memory_response,
          detailSchema: createMemoryResponseDetailSchema({
            id,
            detailSchema: notSchema(detailSchema),
          }),
        }

        const transactionListener: BPListener = {
          type: DEFAULT_EVENTS.memory_response,
          detailSchema: createMemoryResponseDetailSchema({
            id,
            detailSchema,
          }),
        }

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

        const extensionListener: BPListener = {
          type: toExtensionEventType({ extension, event: type }),
          detailSchema: createMemoryEntryDetailSchema(detailSchema),
        }

        const requestEvent: ExtensionRequestEvent = {
          type: toExtensionEventType({ extension, event: EXTENSION_REQUEST_EVENT }),
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
          detailSchema: createMemoryResponseDetailSchema({
            id,
            detailSchema,
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
        const transactionEventType = createTransactionEventType(id)

        const extensionListener: BPListener = {
          type: toExtensionEventType({ extension, event }),
          detailSchema: createMemoryEntryDetailSchema(detailSchema),
        }

        const transactionListener: BPListener = {
          type: transactionEventType,
          detailSchema: createMemoryResponseDetailSchema({
            id,
            detailSchema,
          }),
        }

        const subscribeEvent: MemorySubscribeEvent = {
          type: toExtensionEventType({ extension, event: EXTENSION_MEMORY_EVENTS.memory_subscribe }),
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
          type: toExtensionEventType({ extension, event }),
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

      const bThread: ExtensionParams['bThread'] = ({ label, rules, repeat }) => {
        const thread = _bThread(rules, repeat)
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
              _bsync({
                waitFor: listener,
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
          trigger({
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
          trigger({
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
