import { describe, expect, test } from 'bun:test'
import { $ } from 'bun'
import { TRACE_MESSAGE_KINDS } from '../behavioral.constants.ts'
import type { SelectionTrace, Trace, TransformTrace } from '../behavioral.schemas.ts'
import { behavioral } from '../behavioral.ts'

/**
 * The daemon contract under test — a two-phase external transform loop:
 *
 * Phase 1 (prime): a Transform trace carries the matched listeners
 * (`type`, `query`, `target`). The loop compiles each `query` once per
 * source type — re-fires do not re-register.
 *
 * Phase 2 (execute): a Selection trace whose `selected.type` matches a
 * primed source type runs the query over `selected.detail` (via jq, the
 * production engine) and re-enters the kernel with the transformed payload
 * via `trigger` or `addThread`.
 */

const jqEval = async (query: string, detail: unknown): Promise<unknown> =>
  $`echo ${JSON.stringify(detail)} | jq ${query}`.json()

describe('transform idiom — external two-phase loop', () => {
  test('variant (a): primes on Transform trace, executes jq on matching Selection, triggers target', async () => {
    const { useAddThread, useTrigger, useTrace } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    const selections: SelectionTrace[] = []

    const primed = new Map<string, { query: string; source: string; target: string }>()

    useTrace((msg: Trace) => {
      if (msg.kind === TRACE_MESSAGE_KINDS.transform) {
        const transformMsg = msg as TransformTrace
        for (const t of transformMsg.transform) {
          if (!primed.has(t.target)) primed.set(t.target, { query: t.query, source: t.type, target: t.target })
        }
        return
      }
      if (msg.kind === TRACE_MESSAGE_KINDS.selection) {
        selections.push(msg)
        for (const [, match] of primed) {
          if (match.source !== msg.selected.type) continue
          void jqEval(match.query, msg.selected.detail).then((transformed) => {
            trigger({ type: match.target, detail: transformed as Record<string, unknown> })
          })
        }
      }
    })

    addThread({
      label: 'shaper',
      rules: [{ transform: [{ type: 'order', query: '.order', target: 'ship' }] }],
    })

    trigger({ type: 'order', detail: { order: { id: 'o-1', total: 42 } } })
    await Bun.sleep(50)

    const ship = selections.find((s) => s.selected.type === 'ship')
    expect(ship).toBeDefined()
    expect(ship!.selected.detail).toEqual({ id: 'o-1', total: 42 })
  })

  test('variant (b): multiple transforms prime a pool; addThread fans out request threads', async () => {
    const { useAddThread, useTrigger, useTrace } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    const selections: SelectionTrace[] = []

    const primed = new Map<string, { query: string; source: string; target: string }>()

    useTrace((msg: Trace) => {
      if (msg.kind === TRACE_MESSAGE_KINDS.transform) {
        const transformMsg = msg as TransformTrace
        for (const t of transformMsg.transform) {
          if (!primed.has(t.target)) primed.set(t.target, { query: t.query, source: t.type, target: t.target })
        }
        return
      }
      if (msg.kind === TRACE_MESSAGE_KINDS.selection) {
        selections.push(msg)
        for (const [, match] of primed) {
          if (match.source !== msg.selected.type) continue
          void jqEval(match.query, msg.selected.detail).then((transformed) => {
            addThread({
              label: `transform:${match.target}`,
              once: true,
              rules: [{ request: { type: match.target, detail: transformed as Record<string, unknown> } }],
            })
            // addThread registers the thread; trigger advances the engine
            trigger({ type: match.target, detail: transformed as Record<string, unknown> })
          })
        }
      }
    })

    addThread({
      label: 'multi-shaper',
      rules: [
        {
          transform: [
            { type: 'order', query: '.order', target: 'ship' },
            { type: 'order', query: '.billing', target: 'invoice' },
          ],
        },
      ],
    })

    trigger({
      type: 'order',
      detail: { order: { id: 'o-2' }, billing: { account: 'acc-9' } },
    })
    await Bun.sleep(50)

    const ship = selections.find((s) => s.selected.type === 'ship')
    const invoice = selections.find((s) => s.selected.type === 'invoice')
    expect(ship).toBeDefined()
    expect(invoice).toBeDefined()
    expect(ship!.selected.detail).toEqual({ id: 'o-2' })
    expect(invoice!.selected.detail).toEqual({ account: 'acc-9' })
  })

  test('variant (c): combined trigger + addThread in one pass interleaves through super-steps', async () => {
    const { useAddThread, useTrigger, useTrace } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    const selections: SelectionTrace[] = []

    const primed = new Map<string, { query: string; source: string; target: string }>()

    useTrace((msg: Trace) => {
      if (msg.kind === TRACE_MESSAGE_KINDS.transform) {
        const transformMsg = msg as TransformTrace
        for (const t of transformMsg.transform) {
          if (!primed.has(t.target)) primed.set(t.target, { query: t.query, source: t.type, target: t.target })
        }
        return
      }
      if (msg.kind === TRACE_MESSAGE_KINDS.selection) {
        selections.push(msg)
        for (const [, match] of primed) {
          if (match.source !== msg.selected.type) continue
          void jqEval(match.query, msg.selected.detail).then((transformed) => {
            addThread({
              label: `transform:${match.target}`,
              once: true,
              rules: [{ request: { type: match.target, detail: transformed as Record<string, unknown> } }],
            })
            // Advance the engine after the thread lands
            trigger({ type: match.target, detail: transformed as Record<string, unknown> })
          })
        }
      }
    })

    addThread({
      label: 'combined-shaper',
      rules: [
        {
          transform: [
            { type: 'order', query: '.ship', target: 'ship' },
            { type: 'order', query: '.bill', target: 'bill' },
          ],
        },
      ],
    })

    trigger({
      type: 'order',
      detail: { ship: { id: 's-1' }, bill: { id: 'b-1' } },
    })
    await Bun.sleep(30)

    const ship = selections.find((s) => s.selected.type === 'ship')
    const bill = selections.find((s) => s.selected.type === 'bill')
    expect(ship).toBeDefined()
    expect(bill).toBeDefined()
    expect(ship!.selected.detail).toEqual({ id: 's-1' })
    expect(bill!.selected.detail).toEqual({ id: 'b-1' })
  })

  test('prime-once: re-fires do not re-register; each matching selection dispatches once', async () => {
    const { useAddThread, useTrigger, useTrace } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    const selections: SelectionTrace[] = []

    const primed = new Map<string, { query: string; source: string; target: string }>()
    let primedCount = 0

    useTrace((msg: Trace) => {
      if (msg.kind === TRACE_MESSAGE_KINDS.transform) {
        const transformMsg = msg as TransformTrace
        for (const t of transformMsg.transform) {
          if (!primed.has(t.target)) {
            primed.set(t.target, { query: t.query, source: t.type, target: t.target })
            primedCount += 1
          }
        }
        return
      }
      if (msg.kind === TRACE_MESSAGE_KINDS.selection) {
        selections.push(msg)
        for (const [, match] of primed) {
          if (match.source !== msg.selected.type) continue
          void jqEval(match.query, msg.selected.detail).then((transformed) => {
            trigger({ type: match.target, detail: transformed as Record<string, unknown> })
          })
        }
      }
    })

    addThread({
      label: 'repeater',
      rules: [{ transform: [{ type: 'tick', query: '.', target: 'tock' }] }],
    })

    // Two orders — the transform thread re-parks and re-fires on each.
    trigger({ type: 'tick', detail: { n: 1 } })
    await Bun.sleep(10)
    trigger({ type: 'tick', detail: { n: 2 } })
    await Bun.sleep(50)

    // Primed exactly once despite the listener re-firing.
    expect(primedCount).toBe(1)
    // Each order dispatched exactly one tock.
    const tocks = selections.filter((s) => s.selected.type === 'tock')
    expect(tocks).toHaveLength(2)
    expect(tocks[0]!.selected.detail).toEqual({ n: 1 })
    expect(tocks[1]!.selected.detail).toEqual({ n: 2 })
  })
})
