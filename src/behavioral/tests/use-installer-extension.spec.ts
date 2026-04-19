import { describe, expect, test } from 'bun:test'
import * as z from 'zod'
import { EXTENSION_FUNCTION_IDENTIFIER, SNAPSHOT_MESSAGE_KINDS } from '../behavioral.constants.ts'
import type { SnapshotMessage } from '../behavioral.schemas.ts'
import { behavioral } from '../behavioral.ts'
import { isExtension, useExtension } from '../use-extension.ts'
import { useInstaller } from '../use-installer.ts'

describe('useExtension + useInstaller', () => {
  test('useExtension stamps id and behavioral brand', () => {
    const extension = useExtension('alpha', () => ({}))

    expect(extension.id).toBe('alpha')
    expect(extension.$).toBe(EXTENSION_FUNCTION_IDENTIFIER)
  })

  test('isExtension narrows branded extension callables', () => {
    const extension = useExtension('alpha', () => ({}))
    const unbranded = Object.assign(() => ({}), { id: 'alpha', $: 'not-an-extension' })

    expect(isExtension(extension)).toBe(true)
    expect(isExtension(unbranded)).toBe(false)
    expect(isExtension({ id: 'alpha', $: EXTENSION_FUNCTION_IDENTIFIER })).toBe(false)
    expect(isExtension(null)).toBe(false)
  })

  test('installer wraps trigger and local-prefixes raw request/listener behavior', () => {
    const diagnostics: SnapshotMessage[] = []
    const snapshotListeners: Array<(message: SnapshotMessage) => void | Promise<void>> = []
    const addedThreads: Array<{ label: string; thread: () => Generator<unknown, void, unknown> }> = []
    const triggeredEvents: Array<{ type: string; detail?: unknown }> = []
    let didPing = false
    let memoryBody: unknown
    let memoryTransactionLabel = ''

    const install = useInstaller({
      reportSnapshot: (message) => diagnostics.push(message),
      trigger: (event) => {
        triggeredEvents.push(event)
      },
      useSnapshot: (listener) => {
        snapshotListeners.push(listener)
        return () => {}
      },
      addBThread: (label, thread) => {
        addedThreads.push({ label, thread })
      },
      ttlMs: 1_000,
    })

    const extension = useExtension('alpha', ({ bSync, bThread, memory, extensions, trigger }) => {
      const crossScopeRequest = extensions.request({
        extension: 'beta',
        type: 'intentional',
        detail: { ok: true },
        purpose: 'cross-scope test',
        detailSchema: z.unknown(),
      })
      const crossScopeMemory = extensions.get({
        extension: 'beta',
        event: 'intentional',
        purpose: 'cross-scope memory test',
        detailSchema: z.object({ ok: z.boolean() }),
      })
      memoryTransactionLabel = crossScopeMemory.transactionEventType

      bThread({
        label: 'local_scope',
        rules: [bSync({ request: { type: 'tick' } })],
      })

      bThread({
        label: 'raw_scoped_request',
        rules: [bSync({ request: { type: 'beta:local' } })],
      })

      bThread({
        label: 'external_block',
        rules: [
          bSync({
            block: extensions.block({
              extension: 'peer',
              event: 'danger',
              detailSchema: z.unknown(),
            }),
          }),
        ],
      })

      return {
        ping() {
          didPing = true
        },
        emit_local() {
          trigger({ type: 'local' })
        },
        emit_raw_scoped() {
          trigger({ type: 'beta:local' })
        },
        emit_cross_scope() {
          trigger(crossScopeRequest.requestEvent)
        },
        read_memory() {
          memoryBody = memory.get('alpha:evt')?.body
        },
      }
    })

    const handlers = install(extension)

    const labels = addedThreads.map(({ label }) => label)
    expect(labels).toEqual(expect.arrayContaining(['local_scope', 'raw_scoped_request', 'external_block']))
    expect(labels).toContain(memoryTransactionLabel)

    const localThread = addedThreads.find(({ label }) => label === 'local_scope')
    const rawScopedThread = addedThreads.find(({ label }) => label === 'raw_scoped_request')
    const externalBlockThread = addedThreads.find(({ label }) => label === 'external_block')
    const memoryTransactionThread = addedThreads.find(({ label }) => label === memoryTransactionLabel)

    expect(localThread).toBeDefined()
    expect(rawScopedThread).toBeDefined()
    expect(externalBlockThread).toBeDefined()
    expect(memoryTransactionThread).toBeDefined()

    const localSync = localThread!.thread().next().value as { request?: { type?: string } }
    expect(localSync.request?.type).toBe('alpha:tick')

    const scopedRequestSync = rawScopedThread!.thread().next().value as { request?: { type?: string } }
    expect(scopedRequestSync.request?.type).toBe('alpha:beta:local')

    const blockSync = externalBlockThread!.thread().next().value as { block?: { type?: string } }
    expect(blockSync.block?.type).toBe('peer:danger')

    const memoryTransactionSync = memoryTransactionThread!.thread().next().value as {
      block?: { type?: string; detailMatch?: string }
      interrupt?: { type?: string }
    }
    expect(memoryTransactionSync.block?.type).toBe(memoryTransactionLabel)
    expect(memoryTransactionSync.block?.detailMatch).toBe('invalid')
    expect(memoryTransactionSync.interrupt?.type).toBe(memoryTransactionLabel)

    handlers['alpha:emit_local']?.(undefined)
    expect(triggeredEvents.at(-1)?.type).toBe('alpha:local')

    handlers['alpha:emit_raw_scoped']?.(undefined)
    expect(triggeredEvents.at(-1)?.type).toBe('alpha:beta:local')

    handlers['alpha:emit_cross_scope']?.(undefined)
    const forwardedRequest = triggeredEvents.at(-1)
    expect(forwardedRequest?.type).toBe('beta:extension_request_event')
    expect(forwardedRequest?.detail).toEqual(
      expect.objectContaining({
        type: 'intentional',
      }),
    )

    handlers['alpha:ping']?.(undefined)
    expect(didPing).toBe(true)

    const selectionSnapshot: SnapshotMessage = {
      kind: SNAPSHOT_MESSAGE_KINDS.selection,
      bids: [
        {
          thread: { label: 'thread-1', id: 'bt_1' },
          source: 'request',
          selected: true,
          type: 'alpha:evt',
          priority: 1,
          detail: { ok: true },
        },
      ],
    }
    void snapshotListeners[0]?.(selectionSnapshot)

    handlers['alpha:read_memory']?.(undefined)
    expect(memoryBody).toEqual({ ok: true })
    expect(diagnostics).toEqual([])
  })

  test('raw local names containing colons are selected and do not degrade into block-only syncs', () => {
    const selected: string[] = []
    const snapshots: SnapshotMessage[] = []
    const { addBThread, trigger, useFeedback, useSnapshot, reportSnapshot } = behavioral()
    const install = useInstaller({
      reportSnapshot,
      trigger,
      useSnapshot,
      addBThread,
      ttlMs: 1_000,
    })

    const extension = useExtension('alpha', ({ bSync, bThread }) => {
      bThread({
        label: 'request_with_colon_and_block',
        rules: [
          bSync({
            request: {
              type: 'beta:local',
            },
            block: {
              type: 'forbidden:event',
              detailSchema: z.unknown(),
            },
          }),
        ],
      })

      bThread({
        label: 'wait_for_colon_then_done',
        rules: [
          bSync({
            waitFor: {
              type: 'beta:local',
              detailSchema: z.unknown(),
            },
          }),
          bSync({
            request: {
              type: 'done',
            },
          }),
        ],
      })

      return {}
    })

    useFeedback(install(extension))
    useSnapshot((snapshot) => {
      snapshots.push(snapshot)
    })
    useFeedback({
      'alpha:beta:local': () => {
        selected.push('alpha:beta:local')
      },
      'alpha:done': () => {
        selected.push('alpha:done')
      },
    })

    trigger({ type: 'start' })

    expect(selected).toEqual(['alpha:beta:local', 'alpha:done'])
    const selectedTypes = snapshots
      .filter((snapshot): snapshot is Extract<SnapshotMessage, { kind: 'selection' }> => {
        return snapshot.kind === SNAPSHOT_MESSAGE_KINDS.selection
      })
      .flatMap((snapshot) => snapshot.bids)
      .filter((bid) => bid.selected)
      .map((bid) => bid.type)

    expect(selectedTypes).toEqual(expect.arrayContaining(['alpha:beta:local', 'alpha:done']))
  })

  test('installer reports extension_error when the same extension id is installed twice', () => {
    const diagnostics: SnapshotMessage[] = []
    const install = useInstaller({
      reportSnapshot: (message) => diagnostics.push(message),
      trigger: () => {},
      useSnapshot: () => () => {},
      addBThread: () => {},
      ttlMs: 1_000,
    })

    const extension = useExtension('duplicate', () => ({}))

    const firstInstall = install(extension)
    const secondInstall = install(extension)

    expect(firstInstall).not.toEqual({})
    expect(secondInstall).toEqual({})

    const error = diagnostics.find((message) => message.kind === SNAPSHOT_MESSAGE_KINDS.extension_error)
    expect(error).toBeDefined()
    expect(error).toEqual(
      expect.objectContaining({
        kind: SNAPSHOT_MESSAGE_KINDS.extension_error,
        id: 'duplicate',
      }),
    )
  })

  test('memory request guards allow valid out-of-order responses across concurrent transaction ids', async () => {
    const selected: string[] = []
    const { addBThread, trigger, useFeedback, useSnapshot, reportSnapshot } = behavioral()
    const install = useInstaller({
      reportSnapshot,
      trigger,
      useSnapshot,
      addBThread,
      ttlMs: 1_000,
    })

    let idA = ''
    let idB = ''

    const extension = useExtension('alpha', ({ bSync, bThread, extensions }) => {
      const requestA = extensions.get({
        extension: 'beta',
        event: 'evt_a',
        purpose: 'transaction a',
        detailSchema: z.object({ value: z.literal('A') }),
      })
      const requestB = extensions.get({
        extension: 'beta',
        event: 'evt_b',
        purpose: 'transaction b',
        detailSchema: z.object({ value: z.literal('B') }),
      })

      idA = requestA.requestEvent.detail.id
      idB = requestB.requestEvent.detail.id

      bThread({
        label: 'wait_a',
        rules: [
          bSync({
            waitFor: requestA.transactionListener,
          }),
          bSync({
            request: { type: 'a_done' },
          }),
        ],
      })

      bThread({
        label: 'wait_b',
        rules: [
          bSync({
            waitFor: requestB.transactionListener,
          }),
          bSync({
            request: { type: 'b_done' },
          }),
        ],
      })

      return {}
    })

    useFeedback(install(extension))
    useFeedback({
      'alpha:a_done': () => {
        selected.push('a_done')
      },
      'alpha:b_done': () => {
        selected.push('b_done')
      },
    })

    trigger({ type: 'start' })

    expect(idA.length).toBeGreaterThan(0)
    expect(idB.length).toBeGreaterThan(0)

    trigger({
      type: 'alpha:memory_response',
      detail: {
        id: idB,
        createdAt: 1,
        expiresAt: 2,
        body: { value: 'B' },
      },
    })
    trigger({
      type: 'alpha:memory_response',
      detail: {
        id: idA,
        createdAt: 1,
        expiresAt: 2,
        body: { value: 'A' },
      },
    })

    await Bun.sleep(20)
    expect(selected).toEqual(['b_done', 'a_done'])
  })

  test('malformed memory_response reports extension_error and does not trigger a transaction event', async () => {
    const selected: string[] = []
    const snapshots: SnapshotMessage[] = []
    const { addBThread, trigger, useFeedback, useSnapshot, reportSnapshot } = behavioral()
    const install = useInstaller({
      reportSnapshot,
      trigger,
      useSnapshot,
      addBThread,
      ttlMs: 1_000,
    })

    let requestId = ''
    let transactionEventType = ''

    const extension = useExtension('alpha', ({ bSync, bThread, extensions }) => {
      const request = extensions.get({
        extension: 'beta',
        event: 'evt',
        purpose: 'malformed response test',
        detailSchema: z.object({ ok: z.boolean() }),
      })

      requestId = request.requestEvent.detail.id
      transactionEventType = request.transactionEventType

      bThread({
        label: 'wait_for_transaction',
        rules: [
          bSync({
            waitFor: request.transactionListener,
          }),
          bSync({
            request: { type: 'done' },
          }),
        ],
      })

      return {}
    })

    useFeedback(install(extension))
    useSnapshot((snapshot) => {
      snapshots.push(snapshot)
    })
    useFeedback({
      'alpha:done': () => {
        selected.push('done')
      },
    })

    trigger({ type: 'start' })
    expect(requestId.length).toBeGreaterThan(0)
    expect(transactionEventType.length).toBeGreaterThan(0)

    const malformedSnapshotStart = snapshots.length
    trigger({
      type: 'alpha:memory_response',
      detail: {
        id: requestId,
        createdAt: 'invalid-created-at',
        body: { ok: true },
      },
    })

    await Bun.sleep(20)

    const malformedSelections = snapshots
      .slice(malformedSnapshotStart)
      .filter((snapshot): snapshot is Extract<SnapshotMessage, { kind: 'selection' }> => {
        return snapshot.kind === SNAPSHOT_MESSAGE_KINDS.selection
      })
      .flatMap((snapshot) => snapshot.bids)
      .filter((bid) => bid.selected)
      .map((bid) => bid.type)

    expect(malformedSelections).not.toContain(transactionEventType)
    expect(selected).toEqual([])

    const malformedError = snapshots.slice(malformedSnapshotStart).find((snapshot) => {
      return snapshot.kind === SNAPSHOT_MESSAGE_KINDS.extension_error && snapshot.id === 'alpha'
    })
    expect(malformedError).toBeDefined()

    trigger({
      type: 'alpha:memory_response',
      detail: {
        id: requestId,
        createdAt: 1,
        expiresAt: 2,
        body: { ok: true },
      },
    })

    await Bun.sleep(20)

    expect(selected).toEqual(['done'])
    const selectedTypes = snapshots
      .filter((snapshot): snapshot is Extract<SnapshotMessage, { kind: 'selection' }> => {
        return snapshot.kind === SNAPSHOT_MESSAGE_KINDS.selection
      })
      .flatMap((snapshot) => snapshot.bids)
      .filter((bid) => bid.selected)
      .map((bid) => bid.type)

    expect(selectedTypes).toContain(transactionEventType)
  })
})
