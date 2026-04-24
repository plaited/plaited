import { describe, expect, test } from 'bun:test'
import { behavioral, onType, onTypeWhere, sync, thread } from './helpers.ts'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('doneGuard pattern', () => {
  test('blocks specific events after terminal', () => {
    const log: string[] = []
    const { addBThreads, trigger, useFeedback } = behavioral()

    addBThreads({
      doneGuard: thread([sync({ waitFor: onType('done') }), sync({ block: [onType('work'), onType('other')] })]),
    })

    useFeedback({
      work() {
        log.push('work')
      },
      done() {
        log.push('done')
      },
      other() {
        log.push('other')
      },
    })

    trigger({ type: 'work' })
    trigger({ type: 'done' })
    trigger({ type: 'work' })
    trigger({ type: 'other' })

    expect(log).toEqual(['work', 'done'])
  })
})

describe('shared state guard pattern', () => {
  test('detail-schema block can read shared state', () => {
    const log: string[] = []
    const blockedIds = new Set<string>()
    const { addBThreads, trigger, useFeedback } = behavioral()

    addBThreads({
      guard: thread([
        sync({
          block: onTypeWhere({
            type: 'execute',
            predicate: (detail) => {
              const parsed = detail as { id?: string } | undefined
              return Boolean(parsed?.id && blockedIds.has(parsed.id))
            },
          }),
        }),
      ]),
    })

    useFeedback({
      execute(detail) {
        log.push(`execute:${detail.id}`)
      },
    })

    trigger({ type: 'execute', detail: { id: '1' } })
    blockedIds.add('1')
    trigger({ type: 'execute', detail: { id: '1' } })
    trigger({ type: 'execute', detail: { id: '2' } })

    expect(log).toEqual(['execute:1', 'execute:2'])
  })
})

describe('counter completion pattern', () => {
  test('async tasks re-invoke after all complete', async () => {
    const log: string[] = []
    let pendingCount = 0
    const { trigger, useFeedback } = behavioral()

    useFeedback({
      dispatch(detail) {
        const count = detail.count as number
        pendingCount = count
        log.push(`dispatch:${count}`)
        for (let i = 0; i < count; i++) {
          setTimeout(() => trigger({ type: 'task_done' }), 10 * (i + 1))
        }
      },
      task_done() {
        log.push('task_done')
        pendingCount -= 1
        if (pendingCount === 0) {
          trigger({ type: 'invoke_inference' })
        }
      },
      invoke_inference() {
        log.push('invoke_inference')
      },
    })

    trigger({ type: 'dispatch', detail: { count: 2 } })
    await wait(40)

    expect(log).toEqual(['dispatch:2', 'task_done', 'task_done', 'invoke_inference'])
  })
})
