import { describe, expect, test } from 'bun:test'
import { behavioral, onType, onTypeWhere, sync, thread } from './helpers.ts'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('per-task lifecycle', () => {
  test('dynamic threads are interrupted by message, then re-added for next task', () => {
    const log: string[] = []
    const { addBThreads, trigger, useFeedback } = behavioral()

    useFeedback({
      task(detail) {
        log.push(`task:${detail.prompt}`)
        addBThreads({
          maxIterations: thread(
            [
              sync({ waitFor: onType('tool_result'), interrupt: [onType('message')] }),
              sync({ waitFor: onType('tool_result'), interrupt: [onType('message')] }),
              sync({
                request: { type: 'message', detail: { content: 'Max reached' } },
                interrupt: [onType('message')],
              }),
            ],
            true,
          ),
        })
      },
      tool_result() {
        log.push('tool_result')
      },
      message(detail) {
        log.push(`message:${detail.content}`)
      },
    })

    trigger({ type: 'task', detail: { prompt: 'hello' } })
    trigger({ type: 'tool_result' })
    trigger({ type: 'tool_result' })
    trigger({ type: 'task', detail: { prompt: 'world' } })

    expect(log).toEqual(['task:hello', 'tool_result', 'tool_result', 'message:Max reached', 'task:world'])
  })

  test('message interrupts mid-sequence threads', () => {
    const log: string[] = []
    const { addBThreads, trigger, useFeedback } = behavioral()

    useFeedback({
      task() {
        log.push('task')
        addBThreads({
          maxIterations: thread(
            [
              sync({ waitFor: onType('tool_result'), interrupt: [onType('message')] }),
              sync({ waitFor: onType('tool_result'), interrupt: [onType('message')] }),
              sync({ waitFor: onType('tool_result'), interrupt: [onType('message')] }),
              sync({ request: { type: 'message', detail: { content: 'Max reached' } } }),
            ],
            true,
          ),
        })
      },
      tool_result() {
        log.push('tool_result')
      },
      message(detail) {
        log.push(`message:${detail.content}`)
      },
    })

    trigger({ type: 'task' })
    trigger({ type: 'tool_result' })
    trigger({ type: 'message', detail: { content: 'early finish' } })

    expect(log).toEqual(['task', 'tool_result', 'message:early finish'])
  })
})

describe('task gate', () => {
  test('blocks task-related events between tasks', () => {
    const log: string[] = []
    const taskEvents = new Set(['model_response', 'execute', 'tool_result', 'context_ready'])

    const { addBThreads, trigger, useFeedback } = behavioral()

    addBThreads({
      taskGate: thread([
        sync({
          waitFor: onType('task'),
          block: [
            onTypeWhere({ type: 'model_response', predicate: () => taskEvents.has('model_response') }),
            onTypeWhere({ type: 'execute', predicate: () => taskEvents.has('execute') }),
            onTypeWhere({ type: 'tool_result', predicate: () => taskEvents.has('tool_result') }),
            onTypeWhere({ type: 'context_ready', predicate: () => taskEvents.has('context_ready') }),
          ],
        }),
        sync({ waitFor: onType('message') }),
      ]),
    })

    useFeedback({
      task() {
        log.push('task')
      },
      model_response() {
        log.push('model_response')
      },
      execute() {
        log.push('execute')
      },
      tool_result() {
        log.push('tool_result')
      },
      message() {
        log.push('message')
      },
    })

    trigger({ type: 'model_response' })
    trigger({ type: 'execute' })
    trigger({ type: 'task' })
    trigger({ type: 'execute' })
    trigger({ type: 'message' })
    trigger({ type: 'execute' })

    expect(log).toEqual(['task', 'execute', 'message'])
  })

  test('stale async triggers after task ends are blocked', async () => {
    const log: string[] = []
    const { addBThreads, trigger, useFeedback } = behavioral()

    addBThreads({
      taskGate: thread([
        sync({ waitFor: onType('task'), block: onType('tool_result') }),
        sync({ waitFor: onType('message') }),
      ]),
    })

    useFeedback({
      async execute() {
        log.push('execute:start')
        await wait(30)
        log.push('execute:done')
        trigger({ type: 'tool_result' })
      },
      tool_result() {
        log.push('tool_result')
      },
      task() {
        log.push('task')
      },
      message() {
        log.push('message')
      },
    })

    trigger({ type: 'task' })
    trigger({ type: 'execute' })
    trigger({ type: 'message' })
    await wait(80)

    expect(log).toEqual(['task', 'execute:start', 'message', 'execute:done'])
  })
})
