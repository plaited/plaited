import { describe, expect, test } from 'bun:test'
import type { SnapshotMessage } from '../behavioral.schemas.ts'
import { behavioral } from '../behavioral.ts'

describe('pending_bids snapshot', () => {
  test('publishes pending_bids snapshot with thread states during superstep', () => {
    const seen: SnapshotMessage[] = []
    const { useAddThread, useTrigger, useSnapshot } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    useSnapshot((msg) => {
      seen.push(msg)
    })

    addThread('worker', { rules: [{ request: { type: 'task' } }], once: true })
    trigger({ type: 'start' })

    const pending = seen.find((s) => s.kind === 'pending_bids')
    expect(pending).toBeDefined()
    expect(pending!.kind).toBe('pending_bids')
  })

  test('pending_bids appears before frontier in the same step', () => {
    const seen: SnapshotMessage[] = []
    const { useAddThread, useTrigger, useSnapshot } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    useSnapshot((msg) => {
      seen.push(msg)
    })

    addThread('req', { rules: [{ request: { type: 'ping' } }], once: true })

    // Step 0: pending_bids + frontier (since there's no external trigger yet,
    // the first addThread only sets up running but doesn't trigger a step)
    // Step 1: after trigger, we get: pending_bids → frontier → selection
    trigger({ type: 'start' })

    const pendingIdx = seen.findIndex((s) => s.kind === 'pending_bids')
    const frontierIdx = seen.findIndex((s) => s.kind === 'frontier')

    // Both must be present and pending_bids must come before frontier
    expect(pendingIdx).not.toBe(-1)
    expect(frontierIdx).not.toBe(-1)
    expect(pendingIdx).toBeLessThan(frontierIdx)
  })
})
