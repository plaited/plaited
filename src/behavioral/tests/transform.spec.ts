import { describe, expect, test } from 'bun:test'
import { $ } from 'bun'
import { TRACE_MESSAGE_KINDS } from '../behavioral.constants.ts'
import { behavioral } from '../behavioral.ts'
import type { JsonObject, SelectionTrace, Trace, TransformTrace } from '../behavioral.types.ts'

/**
 * The daemon contract under test — a two-phase external transform loop:
 *
 * Phase 1 (prime): a Transform trace carries `transformers[]` — the pool of
 * `{ query, target, thread }` reshaping contracts for the selected event.
 *
 * Phase 2 (execute): the immediately following Selection trace carries the
 * payload (`selected.detail`). The loop evaluates each primed `query` over
 * the payload via jq and re-enters the kernel with the transformed result
 * via `trigger` or `addThread`.
 */

const jqEval = async (query: string, detail: unknown): Promise<unknown> =>
  $`echo ${JSON.stringify(detail)} | jq ${query}`.json()

type Transformer = { query: string; target: string; thread: string }

/** Creates a two-phase transform loop that records selections and dispatches via the given strategy. */
function createTransformLoop(
  program: ReturnType<typeof behavioral>,
  dispatch: (target: string, transformed: JsonObject, transformer: Transformer) => void,
) {
  const { useTrigger, useTrace } = program
  const trigger = useTrigger()
  const selections: SelectionTrace[] = []
  const transformTraces: TransformTrace[] = []
  let pending: Transformer[] = []

  useTrace((msg: Trace) => {
    if (msg.kind === TRACE_MESSAGE_KINDS.transform) {
      const t = msg as TransformTrace
      transformTraces.push(t)
      pending = [...t.transformers]
      return
    }
    if (msg.kind === TRACE_MESSAGE_KINDS.selection) {
      selections.push(msg)
      if (pending.length === 0) return
      const toProcess = pending
      pending = []
      for (const transformer of toProcess) {
        void jqEval(transformer.query, msg.selected.detail).then((transformed) => {
          // jqEval resolves to unknown; the fixtures' queries always select object sub-keys
          // (or `.` identity over an object detail), so the result is JSON-shaped and object-valued.
          dispatch(transformer.target, transformed as JsonObject, transformer)
        })
      }
    }
  })

  return { trigger, selections, transformTraces }
}

describe('transform idiom — external two-phase loop', () => {
  test('variant (a): single transform — jq on selection detail, triggers target', async () => {
    const program = behavioral()
    const { useAddThread } = program
    const addThread = useAddThread()

    addThread({
      label: 'shaper',
      rules: [{ transform: [{ type: 'order', query: '.order', target: 'ship' }] }],
    })

    const { trigger, selections } = createTransformLoop(program, (target, transformed) => {
      trigger({ type: target, detail: transformed })
    })

    trigger({ type: 'order', detail: { order: { id: 'o-1', total: 42 } } })
    await Bun.sleep(50)

    const ship = selections.find((s) => s.selected.type === 'ship')
    expect(ship).toBeDefined()
    expect(ship!.selected.detail).toEqual({ id: 'o-1', total: 42 })
  })

  test('variant (b): multiple transforms — addThread fans out request threads', async () => {
    const program = behavioral()
    const { useAddThread } = program
    const addThread = useAddThread()

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

    const { trigger, selections } = createTransformLoop(program, (target, transformed) => {
      addThread({
        label: `transform:${target}`,
        once: true,
        rules: [{ request: { type: target, detail: transformed } }],
      })
      trigger({ type: target, detail: transformed })
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

  test('variant (c): combined — trigger one target, addThread the other', async () => {
    const program = behavioral()
    const { useAddThread } = program
    const addThread = useAddThread()

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

    const dispatched: string[] = []
    const { trigger, selections } = createTransformLoop(program, (target, transformed) => {
      dispatched.push(target)
      if (target === 'ship') {
        trigger({ type: target, detail: transformed })
      } else {
        addThread({
          label: `transform:${target}`,
          once: true,
          rules: [{ request: { type: target, detail: transformed } }],
        })
        trigger({ type: target, detail: transformed })
      }
    })

    trigger({
      type: 'order',
      detail: { ship: { id: 's-1' }, bill: { id: 'b-1' } },
    })
    await Bun.sleep(50)

    const ship = selections.find((s) => s.selected.type === 'ship')
    const bill = selections.find((s) => s.selected.type === 'bill')
    expect(ship).toBeDefined()
    expect(bill).toBeDefined()
    expect(ship!.selected.detail).toEqual({ id: 's-1' })
    expect(bill!.selected.detail).toEqual({ id: 'b-1' })
    expect(dispatched).toContain('ship')
    expect(dispatched).toContain('bill')
  })

  test('prime-once: re-firing transforms do not duplicate dispatches', async () => {
    const program = behavioral()
    const { useAddThread } = program
    const addThread = useAddThread()

    addThread({
      label: 'repeater',
      rules: [{ transform: [{ type: 'tick', query: '.', target: 'tock' }] }],
    })

    let dispatchCount = 0
    const { trigger, selections } = createTransformLoop(program, (target, transformed) => {
      dispatchCount += 1
      trigger({ type: target, detail: transformed })
    })

    trigger({ type: 'tick', detail: { n: 1 } })
    await Bun.sleep(20)
    trigger({ type: 'tick', detail: { n: 2 } })
    await Bun.sleep(30)

    const tocks = selections.filter((s) => s.selected.type === 'tock')
    expect(tocks).toHaveLength(2)
    expect(tocks[0]!.selected.detail).toEqual({ n: 1 })
    expect(tocks[1]!.selected.detail).toEqual({ n: 2 })
    // Two dispatches (one per order), not four (duplicated by re-priming)
    expect(dispatchCount).toBe(2)
  })

  test('transform trace shape — transformers pool with thread labels for observability', async () => {
    const program = behavioral()
    const { useAddThread } = program
    const addThread = useAddThread()

    addThread({
      label: 'observer-test',
      rules: [
        {
          transform: [
            { type: 'evt', query: '.a', target: 'out_a' },
            { type: 'evt', query: '.b', target: 'out_b' },
          ],
        },
      ],
    })

    const transformTraces: TransformTrace[] = []
    const { trigger } = createTransformLoop(program, () => {})
    // Re-collect transform traces (createTransformLoop already subscribes, but we need direct access)
    program.useTrace((msg: Trace) => {
      if (msg.kind === TRACE_MESSAGE_KINDS.transform) transformTraces.push(msg as TransformTrace)
    })

    trigger({ type: 'evt', detail: { a: 1, b: 2 } })
    await Bun.sleep(20)

    expect(transformTraces).toHaveLength(1)
    const trace = transformTraces[0]!
    expect(trace.transformers).toHaveLength(2)
    expect(trace.transformers[0]!.thread).toBe('observer-test')
    expect(trace.transformers[0]!.query).toBe('.a')
    expect(trace.transformers[0]!.target).toBe('out_a')
    expect(trace.transformers[1]!.target).toBe('out_b')
  })

  test('no transform trace when no transform listeners match', async () => {
    const program = behavioral()
    const { useAddThread } = program
    const addThread = useAddThread()

    addThread({ label: 'waiter', rules: [{ waitFor: [{ type: 'other' }] }] })

    const transformTraces: TransformTrace[] = []
    const { trigger } = createTransformLoop(program, () => {})
    program.useTrace((msg: Trace) => {
      if (msg.kind === TRACE_MESSAGE_KINDS.transform) transformTraces.push(msg as TransformTrace)
    })

    trigger({ type: 'unrelated', detail: { x: 1 } })
    await Bun.sleep(20)

    expect(transformTraces).toHaveLength(0)
  })
})
