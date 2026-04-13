import { describe, expect, test } from 'bun:test'
import * as z from 'zod'
import { EXTENSION_FUNCTION_IDENTIFIER, SNAPSHOT_MESSAGE_KINDS } from '../behavioral.constants.ts'
import type { SnapshotMessage } from '../behavioral.schemas.ts'
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

  test('installer accepts useExtension modules and scopes local/external listener semantics', () => {
    const diagnostics: SnapshotMessage[] = []
    const snapshotListeners: Array<(message: SnapshotMessage) => void | Promise<void>> = []
    const addedThreads: Array<{ label: string; thread: () => Generator<unknown, void, unknown> }> = []
    let didPing = false
    let memoryBody: unknown

    const install = useInstaller({
      reportSnapshot: (message) => diagnostics.push(message),
      trigger: () => {},
      useSnapshot: (listener) => {
        snapshotListeners.push(listener)
        return () => {}
      },
      addBThread: (label, thread) => {
        addedThreads.push({ label, thread })
      },
      ttlMs: 1_000,
    })

    const extension = useExtension('alpha', ({ bSync, bThread, memory, extensions }) => {
      bThread({
        label: 'local_scope',
        rules: [bSync({ request: { type: 'tick' } })],
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
        read_memory() {
          memoryBody = memory.get('alpha:evt')?.body
        },
      }
    })

    const handlers = install(extension)

    expect(addedThreads.map(({ label }) => label)).toEqual(['local_scope', 'external_block'])

    const localSync = addedThreads[0]!.thread().next().value as { request?: { type?: string } }
    expect(localSync.request?.type).toBe('alpha:tick')

    const blockSync = addedThreads[1]!.thread().next().value as { block?: { type?: string } }
    expect(blockSync.block?.type).toBe('peer:danger')

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
