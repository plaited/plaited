import { expect, mock, test } from 'bun:test'
import { useBehavioral } from 'plaited'
import { wait } from 'plaited/utils'

/**
 * Test suite for useBehavioral factory pattern.
 * Verifies reusable behavioral program configurations with lifecycle management.
 */

test('useBehavioral: basic initialization and event handling', async () => {
  const actual: string[] = []

  const createProgram = useBehavioral<
    {
      PROCESSED: (value: string) => void
      PROCESS: (data: string) => void
    },
    { prefix: string }
  >({
    publicEvents: ['PROCESS'],

    bProgram({ trigger, prefix }) {
      return {
        PROCESS(data) {
          const result = `${prefix}:${data}`
          actual.push(result)
          trigger({ type: 'PROCESSED', detail: result })
        },
        PROCESSED(value) {
          actual.push(`processed:${value}`)
        },
      }
    },
  })

  const publicTrigger = await createProgram({ prefix: 'test' })

  publicTrigger({ type: 'PROCESS', detail: 'data' })

  expect(actual).toEqual(['test:data', 'processed:test:data'])
})

test('useBehavioral: public events filtering allows only whitelisted events', async () => {
  const processedSpy = mock()
  const blockedSpy = mock()

  const createProgram = useBehavioral<
    {
      PROCESSED: () => void
      INTERNAL: () => void
      ALLOWED: () => void
      BLOCKED: () => void
    },
    Record<string, never>
  >({
    publicEvents: ['ALLOWED'],

    bProgram({ trigger }) {
      return {
        ALLOWED() {
          trigger({ type: 'PROCESSED' })
        },
        BLOCKED() {
          trigger({ type: 'INTERNAL' })
        },
        PROCESSED: processedSpy,
        INTERNAL: blockedSpy,
      }
    },
  })

  const publicTrigger = await createProgram({})

  // Allowed event should work
  publicTrigger({ type: 'ALLOWED' })
  expect(processedSpy).toHaveBeenCalledTimes(1)

  // Blocked event should throw an error (filtered out by public events)
  expect(() => {
    publicTrigger({ type: 'BLOCKED' })
  }).toThrow('Event type "BLOCKED" is not allowed')

  // Internal handler should never be called since BLOCKED can't be triggered
  expect(blockedSpy).not.toHaveBeenCalled()
})

test('useBehavioral: context injection works correctly', async () => {
  type Context = {
    database: { save: (data: string) => void }
    apiKey: string
  }

  const saveSpy = mock()

  const createProgram = useBehavioral<
    {
      SAVED: () => void
      SAVE: (data: string) => void
    },
    Context
  >({
    publicEvents: ['SAVE'],

    bProgram({ trigger, database, apiKey }) {
      return {
        SAVE(data) {
          database.save(`${apiKey}:${data}`)
          trigger({ type: 'SAVED' })
        },
        SAVED: saveSpy,
      }
    },
  })

  const mockDb = { save: mock() }
  const publicTrigger = await createProgram({
    database: mockDb,
    apiKey: 'secret123',
  })

  publicTrigger({ type: 'SAVE', detail: 'data' })

  expect(mockDb.save).toHaveBeenCalledWith('secret123:data')
  expect(saveSpy).toHaveBeenCalledTimes(1)
})

test('useBehavioral: async initialization works correctly', async () => {
  const initSpy = mock()

  const createProgram = useBehavioral<
    {
      READY: () => void
    },
    { delay: number }
  >({
    async bProgram({ bThreads, trigger, delay, bSync }) {
      // Simulate async setup
      await wait(delay)
      initSpy()

      bThreads.set({
        starter: bSync({ waitFor: 'START', request: { type: 'DO_START' } }),
      })

      return {
        READY() {
          trigger({ type: 'READY' })
        },
      }
    },
  })

  const startTime = Date.now()
  await createProgram({ delay: 50 })
  const elapsed = Date.now() - startTime

  // Initialization should have waited for delay (with small tolerance for timer imprecision)
  expect(elapsed).toBeGreaterThanOrEqual(45)
  expect(initSpy).toHaveBeenCalledTimes(1)
})

test('useBehavioral: no public events means all events are filtered', async () => {
  const spy = mock()

  const createProgram = useBehavioral<Record<string, never>, Record<string, never>>({
    // No publicEvents specified
    bProgram({ bThreads, bThread, bSync }) {
      bThreads.set({
        handler: bThread([bSync({ waitFor: 'ANY_EVENT' }), bSync({ request: { type: 'PROCESS' } })], true),
      })

      return {
        PROCESS: spy,
      }
    },
  })

  const publicTrigger = await createProgram({})

  // Without public events, triggering should throw an error
  expect(() => {
    publicTrigger({ type: 'ANY_EVENT' })
  }).toThrow('Event type "ANY_EVENT" is not allowed. Only public event types can be triggered: []')

  // The handler should not be called
  expect(spy).not.toHaveBeenCalled()
})
