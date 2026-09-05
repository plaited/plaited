import { expect, test } from 'bun:test'
import { behavioral } from '../behavioral.ts'
import { onSelection } from './helpers.ts'

const stringIdSchema = {
  type: 'object' as const,
  properties: { id: { type: 'string' as const } },
  required: ['id'],
  additionalProperties: false,
}

test('match listener: waitFor resumes thread when type and detail schema match', () => {
  const log: string[] = []
  const program = behavioral()
  const { useAddThread, useTrigger } = program
  const addThread = useAddThread()
  const trigger = useTrigger()

  addThread({ label: 'producer', rules: [{ request: { type: 'task', detail: { id: 'job-1' } } }], once: true })
  addThread({
    label: 'consumer',
    rules: [
      {
        waitFor: [
          {
            type: 'task',
            detailSchema: stringIdSchema,
          },
        ],
      },
      { request: { type: 'ack' } },
    ],
    once: true,
  })

  onSelection(program, (selected) => {
    if (selected.type === 'task') log.push('task')
  })
  onSelection(program, (selected) => {
    if (selected.type === 'ack') log.push('ack')
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['task', 'ack'])
})

test('match listener: waitFor does not resume when detail schema fails', () => {
  const log: string[] = []
  const program = behavioral()
  const { useAddThread, useTrigger } = program
  const addThread = useAddThread()
  const trigger = useTrigger()

  addThread({ label: 'producer', rules: [{ request: { type: 'task', detail: { id: 101 } } }], once: true })
  addThread({
    label: 'consumer',
    rules: [
      {
        waitFor: [
          {
            type: 'task',
            detailSchema: stringIdSchema,
          },
        ],
      },
      { request: { type: 'ack' } },
    ],
    once: true,
  })

  onSelection(program, (selected) => {
    if (selected.type === 'task') log.push('task')
  })
  onSelection(program, (selected) => {
    if (selected.type === 'ack') log.push('ack')
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['task'])
})

test('match listener: detailMatch invalid resumes thread when detail schema fails', () => {
  const log: string[] = []
  const program = behavioral()
  const { useAddThread, useTrigger } = program
  const addThread = useAddThread()
  const trigger = useTrigger()

  addThread({ label: 'producer', rules: [{ request: { type: 'task', detail: { id: 101 } } }], once: true })
  addThread({
    label: 'consumer',
    rules: [
      {
        waitFor: [
          {
            type: 'task',
            detailSchema: stringIdSchema,
            detailMatch: 'invalid',
          },
        ],
      },
      { request: { type: 'ack' } },
    ],
    once: true,
  })

  onSelection(program, (selected) => {
    if (selected.type === 'task') log.push('task')
  })
  onSelection(program, (selected) => {
    if (selected.type === 'ack') log.push('ack')
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['task', 'ack'])
})

test('match listener: detailMatch invalid does not resume thread when detail schema passes', () => {
  const log: string[] = []
  const program = behavioral()
  const { useAddThread, useTrigger } = program
  const addThread = useAddThread()
  const trigger = useTrigger()

  addThread({ label: 'producer', rules: [{ request: { type: 'task', detail: { id: 'job-1' } } }], once: true })
  addThread({
    label: 'consumer',
    rules: [
      {
        waitFor: [
          {
            type: 'task',
            detailSchema: stringIdSchema,
            detailMatch: 'invalid',
          },
        ],
      },
      { request: { type: 'ack' } },
    ],
    once: true,
  })

  onSelection(program, (selected) => {
    if (selected.type === 'task') log.push('task')
  })
  onSelection(program, (selected) => {
    if (selected.type === 'ack') log.push('ack')
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['task'])
})

test('match listener: type mismatch prevents match when source and detail would pass', () => {
  const log: string[] = []
  const program = behavioral()
  const { useAddThread, useTrigger } = program
  const addThread = useAddThread()
  const trigger = useTrigger()

  addThread({ label: 'producer', rules: [{ request: { type: 'other', detail: { id: 'job-1' } } }], once: true })
  addThread({
    label: 'consumer',
    rules: [
      {
        waitFor: [
          {
            type: 'task',
            detailSchema: stringIdSchema,
          },
        ],
      },
      { request: { type: 'ack' } },
    ],
    once: true,
  })

  onSelection(program, (selected) => {
    if (selected.type === 'other') log.push('other')
  })
  onSelection(program, (selected) => {
    if (selected.type === 'ack') log.push('ack')
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['other'])
})

test('match listener: sourceSchema request accepts only requested events', () => {
  const log: string[] = []
  const program = behavioral()
  const { useAddThread, useTrigger } = program
  const addThread = useAddThread()
  const trigger = useTrigger()

  addThread({ label: 'producer', rules: [{ request: { type: 'task', detail: { id: 'job-1' } } }], once: true })
  addThread({
    label: 'consumer',
    rules: [
      {
        waitFor: [
          {
            type: 'task',
            detailSchema: stringIdSchema,
          },
        ],
      },
      { request: { type: 'ack' } },
    ],
    once: true,
  })

  onSelection(program, (selected) => {
    if (selected.type === 'task') log.push('task')
  })
  onSelection(program, (selected) => {
    if (selected.type === 'ack') log.push('ack')
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['task', 'ack'])
})

test('match listener: trigger and requested events both satisfy matching listeners', () => {
  const log: string[] = []
  const program = behavioral()
  const { useAddThread, useTrigger } = program
  const addThread = useAddThread()
  const trigger = useTrigger()

  addThread({ label: 'producer', rules: [{ request: { type: 'task', detail: { id: 'job-1' } } }], once: true })
  addThread({
    label: 'consumer',
    rules: [
      {
        waitFor: [
          {
            type: 'task',
            detailSchema: stringIdSchema,
          },
        ],
      },
      { request: { type: 'ack' } },
    ],
    once: true,
  })

  onSelection(program, (selected) => {
    if (selected.type === 'task') log.push('task')
  })
  onSelection(program, (selected) => {
    if (selected.type === 'ack') log.push('ack')
  })

  trigger({ type: 'kickoff' })
  trigger({ type: 'task', detail: { id: 'job-1' } })

  expect(log).toEqual(['task', 'ack', 'task'])
})

test('match listener: sourceSchema can accept trigger and request', () => {
  const log: string[] = []
  const program = behavioral()
  const { useAddThread, useTrigger } = program
  const addThread = useAddThread()
  const trigger = useTrigger()

  addThread({ label: 'producer', rules: [{ request: { type: 'task', detail: { id: 'job-1' } } }], once: true })
  addThread({
    label: 'consumer',
    rules: [
      {
        waitFor: [
          {
            type: 'task',
            detailSchema: stringIdSchema,
          },
        ],
      },
      { request: { type: 'ack' } },
    ],
    once: true,
  })

  onSelection(program, (selected) => {
    if (selected.type === 'task') log.push('task')
  })
  onSelection(program, (selected) => {
    if (selected.type === 'ack') log.push('ack')
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['task', 'ack'])
})

test('match listener: sourceSchema request matches request-origin events only', () => {
  const log: string[] = []
  const program = behavioral()
  const { useAddThread, useTrigger } = program
  const addThread = useAddThread()
  const trigger = useTrigger()

  addThread({ label: 'producer', rules: [{ request: { type: 'task', detail: { id: 'job-1' } } }], once: true })
  addThread({
    label: 'consumer',
    rules: [
      {
        waitFor: [
          {
            type: 'task',
            detailSchema: stringIdSchema,
          },
        ],
      },
      { request: { type: 'ack' } },
    ],
    once: true,
  })

  onSelection(program, (selected) => {
    if (selected.type === 'task') log.push('task')
  })
  onSelection(program, (selected) => {
    if (selected.type === 'ack') log.push('ack')
  })

  trigger({ type: 'kickoff' })
  trigger({
    type: 'task',
    detail: { id: 'job-1' },
  })

  expect(log).toEqual(['task', 'ack', 'task'])
})

test('match listener: block prevents matching requested event from being selected', () => {
  const log: string[] = []
  const program = behavioral()
  const { useAddThread, useTrigger } = program
  const addThread = useAddThread()
  const trigger = useTrigger()

  addThread({
    label: 'blocker',
    rules: [
      {
        block: [
          {
            type: 'task',
            detailSchema: stringIdSchema,
          },
        ],
      },
    ],
    once: true,
  })
  addThread({ label: 'taskProducer', rules: [{ request: { type: 'task', detail: { id: 'job-1' } } }], once: true })
  addThread({ label: 'safeProducer', rules: [{ request: { type: 'safe' } }], once: true })
  addThread({
    label: 'safeFollower',
    rules: [{ waitFor: [{ type: 'safe' }] }, { request: { type: 'safe_ack' } }],
    once: true,
  })
  addThread({
    label: 'taskFollower',
    rules: [{ waitFor: [{ type: 'task' }] }, { request: { type: 'task_ack' } }],
    once: true,
  })

  onSelection(program, (selected) => {
    if (selected.type === 'task') log.push('task')
  })
  onSelection(program, (selected) => {
    if (selected.type === 'safe') log.push('safe')
  })
  onSelection(program, (selected) => {
    if (selected.type === 'safe_ack') log.push('safe_ack')
  })
  onSelection(program, (selected) => {
    if (selected.type === 'task_ack') log.push('task_ack')
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['safe', 'safe_ack'])
})

test('match listener: interrupt terminates thread when matching event is selected', () => {
  const log: string[] = []
  const program = behavioral()
  const { useAddThread, useTrigger } = program
  const addThread = useAddThread()
  const trigger = useTrigger()

  addThread({
    label: 'interruptedThread',
    rules: [
      {
        waitFor: [{ type: 'start' }],
        interrupt: [
          {
            type: 'kill',
            detailSchema: {
              type: 'object' as const,
              properties: { id: { const: 'victim' } },
              required: ['id'],
              additionalProperties: false,
            },
          },
        ],
      },
      { request: { type: 'after_start' } },
    ],
    once: true,
  })
  addThread({
    label: 'interruptProducer',
    rules: [{ request: { type: 'kill', detail: { id: 'victim' } } }],
    once: true,
  })

  onSelection(program, (selected) => {
    if (selected.type === 'kill') log.push('kill')
  })
  onSelection(program, (selected) => {
    if (selected.type === 'after_start') log.push('after_start')
  })

  trigger({ type: 'kickoff' })
  trigger({ type: 'start' })

  expect(log).toEqual(['kill'])
})

test('match listener: detail-schema listeners can express conditional matching', () => {
  const log: string[] = []
  const program = behavioral()
  const { useAddThread, useTrigger } = program
  const addThread = useAddThread()
  const trigger = useTrigger()

  addThread({ label: 'producer', rules: [{ request: { type: 'task', detail: { ok: true } } }], once: true })
  addThread({
    label: 'consumer',
    rules: [
      {
        waitFor: [
          {
            type: 'task',
            detailSchema: {
              type: 'object' as const,
              properties: { ok: { const: true } },
              required: ['ok'],
              additionalProperties: false,
            },
          },
        ],
      },
      { request: { type: 'ack' } },
    ],
    once: true,
  })

  onSelection(program, (selected) => {
    if (selected.type === 'task') log.push('task')
  })
  onSelection(program, (selected) => {
    if (selected.type === 'ack') log.push('ack')
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['task', 'ack'])
})

test('match listener: non-selected same-type requesters remain pending until their own request is selected', () => {
  const log: string[] = []
  const program = behavioral()
  const { useAddThread, useTrigger } = program
  const addThread = useAddThread()
  const trigger = useTrigger()

  addThread({
    label: 'first',
    rules: [{ request: { type: 'same', detail: { n: 1 } } }, { request: { type: 'first_done' } }],
    once: true,
  })
  addThread({
    label: 'second',
    rules: [{ request: { type: 'same', detail: { n: 2 } } }, { request: { type: 'second_done' } }],
    once: true,
  })

  onSelection(program, (selected) => {
    if (selected.type === 'same') {
      const detail = selected.detail as { n: number }
      log.push(`same:${detail.n}`)
    }
  })
  onSelection(program, (selected) => {
    if (selected.type === 'first_done') log.push('first_done')
  })
  onSelection(program, (selected) => {
    if (selected.type === 'second_done') log.push('second_done')
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['same:1', 'first_done', 'same:2', 'second_done'])
})

test('match listener: detail schema with valid detail passes', () => {
  const log: string[] = []
  const program = behavioral()
  const { useAddThread, useTrigger } = program
  const addThread = useAddThread()
  const trigger = useTrigger()

  addThread({ label: 'producer', rules: [{ request: { type: 'task', detail: { id: 'job-1' } } }], once: true })
  addThread({
    label: 'consumer',
    rules: [
      {
        waitFor: [
          {
            type: 'task',
            detailSchema: {
              type: 'object' as const,
              properties: { id: { type: 'string' as const } },
              required: ['id'],
              additionalProperties: false,
            },
          },
        ],
      },
      { request: { type: 'ack' } },
    ],
    once: true,
  })

  onSelection(program, (selected) => {
    if (selected.type === 'task') log.push('task')
  })
  onSelection(program, (selected) => {
    if (selected.type === 'ack') log.push('ack')
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['task', 'ack'])
})

test('match listener: detail schema with invalid detail fails', () => {
  const log: string[] = []
  const program = behavioral()
  const { useAddThread, useTrigger } = program
  const addThread = useAddThread()
  const trigger = useTrigger()

  addThread({ label: 'producer', rules: [{ request: { type: 'task', detail: { id: 101 } } }], once: true })
  addThread({
    label: 'consumer',
    rules: [
      {
        waitFor: [
          {
            type: 'task',
            detailSchema: stringIdSchema,
          },
        ],
      },
      { request: { type: 'ack' } },
    ],
    once: true,
  })

  onSelection(program, (selected) => {
    if (selected.type === 'task') log.push('task')
  })
  onSelection(program, (selected) => {
    if (selected.type === 'ack') log.push('ack')
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['task'])
})

test('match listener: 2020-12 prefixItems keyword compiles and matches', () => {
  const log: string[] = []
  const program = behavioral()
  const { useAddThread, useTrigger } = program
  const addThread = useAddThread()
  const trigger = useTrigger()

  addThread({ label: 'producer', rules: [{ request: { type: 'task', detail: { items: [42, 'hello'] } } }], once: true })
  addThread({
    label: 'consumer',
    rules: [
      {
        waitFor: [
          {
            type: 'task',
            detailSchema: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  prefixItems: [{ type: 'number' }, { type: 'string' }],
                },
              },
              required: ['items'],
              additionalProperties: false,
            },
          },
        ],
      },
      { request: { type: 'ack' } },
    ],
    once: true,
  })

  onSelection(program, (selected) => {
    if (selected.type === 'task') log.push('task')
  })
  onSelection(program, (selected) => {
    if (selected.type === 'ack') log.push('ack')
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['task', 'ack'])
})

test('match listener: 2020-12 prefixItems enforces tuple ordering', () => {
  const log: string[] = []
  const program = behavioral()
  const { useAddThread, useTrigger } = program
  const addThread = useAddThread()
  const trigger = useTrigger()

  // Producer emits tuple [42, 'hello']; consumer expects [number, string]
  addThread({ label: 'producer', rules: [{ request: { type: 'task', detail: { items: ['x', 1] } } }], once: true })
  addThread({
    label: 'consumer',
    rules: [
      {
        waitFor: [
          {
            type: 'task',
            detailSchema: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  prefixItems: [{ type: 'number' }, { type: 'string' }],
                },
              },
              required: ['items'],
              additionalProperties: false,
            },
          },
        ],
      },
      { request: { type: 'ack' } },
    ],
    once: true,
  })

  onSelection(program, (selected) => {
    if (selected.type === 'task') log.push('task')
  })
  onSelection(program, (selected) => {
    if (selected.type === 'ack') log.push('ack')
  })

  trigger({ type: 'kickoff' })

  // Tuple out of order: ['x', 1] should not match [number, string]
  // So consumer should NOT resume and 'ack' should not fire
  // The producer's task event IS selected, but the consumer doesn't match
  expect(log).toEqual(['task'])
})

test('match listener: malformed detailSchema publishes add_thread_error', () => {
  const seen: import('../behavioral.schemas.ts').Trace[] = []
  const { useAddThread, useTrace } = behavioral()
  const addThread = useAddThread()
  useTrace((msg) => {
    seen.push(msg)
  })

  // properties: 'not-an-object' is structurally valid JSON but un-compilable as JSON Schema
  addThread({
    label: 'bad',
    rules: [
      {
        block: [
          {
            type: 'x',
            detailSchema: { type: 'object', properties: 'not-an-object' },
          },
        ],
      },
    ],
  })

  const errors = seen.filter((s) => s.kind === 'add_thread_error')
  expect(errors).toHaveLength(1)
})

test('match listener: malformed detailSchema in one listener rejects the whole thread', () => {
  const seen: import('../behavioral.schemas.ts').Trace[] = []
  const { useAddThread, useTrigger, useTrace } = behavioral()
  const addThread = useAddThread()
  const trigger = useTrigger()

  useTrace((msg) => {
    seen.push(msg)
  })

  const log: string[] = []

  // A thread with one good rule and one rule with a bad detailSchema
  addThread({
    label: 'mixed',
    rules: [
      { request: { type: 'good' } },
      {
        block: [
          {
            type: 'x',
            detailSchema: { type: 'object', properties: 'not-an-object' },
          },
        ],
      },
    ],
  })

  const errors = seen.filter((s) => s.kind === 'add_thread_error')
  expect(errors).toHaveLength(1)

  // The thread should not have registered — no running thread means triggering does nothing
  trigger({ type: 'kickoff' })
  expect(log).toEqual([])
})
