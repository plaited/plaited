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
    expect(memoryTransactionSync.block?.type).toBe('alpha:memory_response')
    expect(memoryTransactionSync.block?.detailMatch).toBe('invalid')
    expect(memoryTransactionSync.interrupt?.type).toBe('alpha:memory_response')

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
})
