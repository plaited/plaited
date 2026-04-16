import { describe, expect, test } from 'bun:test'
import type { InferenceAdapter, InferencePolicy, InferenceRequest } from '../inference.types.ts'
import { createInferenceBridge } from '../inference-bridge.ts'

const createTestRequest = (overrides: Partial<InferenceRequest> = {}): InferenceRequest => ({
  requestId: 'test-req-1',
  correlationId: 'corr-1',
  executor: { executorId: 'test-executor', sessionId: 'session-1' },
  payload: { prompt: 'Hello, world!' },
  ...overrides,
})

const createFakeAdapter = (responses: Map<string, { data: Record<string, unknown> } | Error>): InferenceAdapter => ({
  execute: async (request) => {
    const response = responses.get(request.requestId)
    if (!response) {
      throw new Error(`No mock response for requestId: ${request.requestId}`)
    }
    if (response instanceof Error) {
      throw response
    }
    return { requestId: request.requestId, data: response.data }
  },
})

describe('inference bridge', () => {
  describe('pass-through success', () => {
    test('returns response and trajectory on successful inference', async () => {
      const adapter = createFakeAdapter(
        new Map([
          [
            'test-req-1',
            {
              data: {
                content: 'Hello back!',
                model: 'test-model',
              },
            },
          ],
        ]),
      )

      const bridge = createInferenceBridge({ adapter })
      const request = createTestRequest()
      const result = await bridge.execute(request)

      expect(result.response.requestId).toBe('test-req-1')
      expect(result.response.data.content).toBe('Hello back!')
      expect(result.trajectory).toBeDefined()
      expect(result.trajectory.requestId).toBe('test-req-1')
      expect(result.trajectory.outcome.status).toBe('success')
    })

    test('preserves correlationId in request and response', async () => {
      const adapter = createFakeAdapter(
        new Map([
          [
            'test-req-1',
            {
              data: {
                content: 'Response with correlation',
              },
            },
          ],
        ]),
      )

      const bridge = createInferenceBridge({ adapter })
      const request = createTestRequest({ correlationId: 'my-correlation-id' })
      const result = await bridge.execute(request)

      expect(result.response.requestId).toBe('test-req-1')
      expect(result.trajectory.outcome.status).toBe('success')
    })

    test('emits request and response bridge events', async () => {
      const adapter = createFakeAdapter(
        new Map([
          [
            'test-req-1',
            {
              data: { content: 'test' },
            },
          ],
        ]),
      )

      const bridge = createInferenceBridge({ adapter })
      const request = createTestRequest()
      const result = await bridge.execute(request)

      const eventTypes = result.trajectory.events.map((e) => e.type)
      expect(eventTypes).toContain('inference:request')
      expect(eventTypes).toContain('inference:response')
      expect(eventTypes).toContain('inference:policy_seam')
    })

    test('captures BP snapshots in trajectory', async () => {
      const adapter = createFakeAdapter(
        new Map([
          [
            'test-req-1',
            {
              data: { content: 'test' },
            },
          ],
        ]),
      )

      const bridge = createInferenceBridge({ adapter })
      const request = createTestRequest()
      const result = await bridge.execute(request)

      // BP snapshots should be captured for policy_seam and response events
      expect(result.trajectory.snapshots.length).toBeGreaterThan(0)
      expect(result.trajectory.snapshots.every((s) => s.requestId === 'test-req-1')).toBe(true)
    })
  })

  describe('request correlation', () => {
    test('maintains correct request-response correlation', async () => {
      const responses = new Map<string, { data: Record<string, unknown> }>([
        ['req-a', { data: { content: 'Response A' } }],
        ['req-b', { data: { content: 'Response B' } }],
        ['req-c', { data: { content: 'Response C' } }],
      ])

      const adapter = createFakeAdapter(responses)
      const bridge = createInferenceBridge({ adapter })

      const resultA = await bridge.execute(createTestRequest({ requestId: 'req-a' }))
      const resultB = await bridge.execute(createTestRequest({ requestId: 'req-b' }))
      const resultC = await bridge.execute(createTestRequest({ requestId: 'req-c' }))

      expect(resultA.response.data.content).toBe('Response A')
      expect(resultB.response.data.content).toBe('Response B')
      expect(resultC.response.data.content).toBe('Response C')

      expect(resultA.trajectory.requestId).toBe('req-a')
      expect(resultB.trajectory.requestId).toBe('req-b')
      expect(resultC.trajectory.requestId).toBe('req-c')
    })

    test('each request gets unique trajectoryId', async () => {
      const adapter = createFakeAdapter(
        new Map([
          ['req-1', { data: { content: 'one' } }],
          ['req-2', { data: { content: 'two' } }],
        ]),
      )

      const bridge = createInferenceBridge({ adapter })
      const result1 = await bridge.execute(createTestRequest({ requestId: 'req-1' }))
      const result2 = await bridge.execute(createTestRequest({ requestId: 'req-2' }))

      expect(result1.trajectory.trajectoryId).not.toBe(result2.trajectory.trajectoryId)
    })
  })

  describe('policy seam participation', () => {
    test('default policy allows all requests through', async () => {
      const adapter = createFakeAdapter(new Map([['test-req-1', { data: { content: 'allowed' } }]]))

      const bridge = createInferenceBridge({ adapter })
      const result = await bridge.execute(createTestRequest())

      expect(result.trajectory.outcome.status).toBe('success')
    })

    test('policy seam event is emitted', async () => {
      const adapter = createFakeAdapter(new Map([['test-req-1', { data: { content: 'test' } }]]))

      const bridge = createInferenceBridge({ adapter })
      const request = createTestRequest()
      const result = await bridge.execute(request)

      const policyEvents = result.trajectory.events.filter((e) => e.type === 'inference:policy_seam')
      expect(policyEvents.length).toBe(1)
      expect(policyEvents[0]!.detail).toEqual({
        type: 'inference:policy_seam',
        request,
        allowed: true,
      })
    })

    test('custom blocking policy blocks request', async () => {
      const adapter = createFakeAdapter(new Map([['blocked-req', { data: { content: 'should not see this' } }]]))

      const blockingPolicy: InferencePolicy = {
        evaluate: (request) => request.requestId !== 'blocked-req',
      }

      const bridge = createInferenceBridge({ adapter, policy: blockingPolicy })
      const result = await bridge.execute(createTestRequest({ requestId: 'blocked-req' }))

      expect(result.trajectory.outcome.status).toBe('blocked')
      if (result.trajectory.outcome.status === 'blocked') {
        expect(result.trajectory.outcome.reason).toContain('policy evaluation returned false')
      }
    })

    test('blocked request does not call adapter', async () => {
      let adapterCalled = false
      const adapter: InferenceAdapter = {
        execute: async () => {
          adapterCalled = true
          return { requestId: 'test', data: {} }
        },
      }

      const blockingPolicy: InferencePolicy = {
        evaluate: () => false,
      }

      const bridge = createInferenceBridge({ adapter, policy: blockingPolicy })
      await bridge.execute(createTestRequest())

      expect(adapterCalled).toBe(false)
    })

    test('custom allowing policy allows request through', async () => {
      const adapter = createFakeAdapter(new Map([['test-req-1', { data: { content: 'allowed by custom policy' } }]]))

      const customPolicy: InferencePolicy = {
        evaluate: (request) => request.executor.executorId === 'test-executor',
      }

      const bridge = createInferenceBridge({ adapter, policy: customPolicy })
      const result = await bridge.execute(createTestRequest())

      expect(result.trajectory.outcome.status).toBe('success')
      expect(result.response.data.content).toBe('allowed by custom policy')
    })
  })

  describe('upstream failure', () => {
    test('handles adapter error gracefully', async () => {
      const adapter = createFakeAdapter(new Map([['test-req-1', new Error('Upstream model unavailable')]]))

      const bridge = createInferenceBridge({ adapter })
      const result = await bridge.execute(createTestRequest())

      expect(result.trajectory.outcome.status).toBe('error')
      if (result.trajectory.outcome.status === 'error') {
        expect(result.trajectory.outcome.error.message).toBe('Upstream model unavailable')
      }
    })

    test('emits error bridge event on upstream failure', async () => {
      const adapter = createFakeAdapter(new Map([['test-req-1', new Error('Connection timeout')]]))

      const bridge = createInferenceBridge({ adapter })
      const result = await bridge.execute(createTestRequest())

      const errorEvents = result.trajectory.events.filter((e) => e.type === 'inference:error')
      expect(errorEvents.length).toBe(1)
      expect(errorEvents[0]!.detail.type).toBe('inference:error')
      if (errorEvents[0]!.detail.type === 'inference:error') {
        expect(errorEvents[0]!.detail.error.requestId).toBe('test-req-1')
        expect(errorEvents[0]!.detail.error.message).toBe('Connection timeout')
        expect(errorEvents[0]!.detail.error.code).toBe('Error')
      }
    })

    test('preserves trajectory on upstream failure', async () => {
      const adapter = createFakeAdapter(new Map([['test-req-1', new Error('API key invalid')]]))

      const bridge = createInferenceBridge({ adapter })
      const result = await bridge.execute(createTestRequest())

      expect(result.trajectory.trajectoryId).toBeDefined()
      expect(result.trajectory.requestId).toBe('test-req-1')
      expect(result.trajectory.events.length).toBeGreaterThan(0)
      expect(result.trajectory.snapshots.length).toBeGreaterThan(0)
    })

    test('captures error code when available', async () => {
      const customError = new Error('Rate limit exceeded')
      customError.name = 'RateLimitError'

      const adapter = createFakeAdapter(new Map([['test-req-1', customError]]))

      const bridge = createInferenceBridge({ adapter })
      const result = await bridge.execute(createTestRequest())

      expect(result.trajectory.outcome.status).toBe('error')
      if (result.trajectory.outcome.status === 'error') {
        expect(result.trajectory.outcome.error.code).toBe('RateLimitError')
      }
    })
  })

  describe('eval mapping', () => {
    test('trajectory has required eval-compatible shape', async () => {
      const adapter = createFakeAdapter(new Map([['test-req-1', { data: { content: 'eval test' } }]]))

      const bridge = createInferenceBridge({ adapter })
      const result = await bridge.execute(createTestRequest())

      const { trajectory } = result

      // Required fields for eval compatibility
      expect(trajectory.trajectoryId).toMatch(/^traj_/)
      expect(trajectory.requestId).toBe('test-req-1')
      expect(Array.isArray(trajectory.events)).toBe(true)
      expect(Array.isArray(trajectory.snapshots)).toBe(true)
      expect(['success', 'error', 'blocked']).toContain(trajectory.outcome.status)
    })

    test('snapshot has required eval fields', async () => {
      const adapter = createFakeAdapter(new Map([['test-req-1', { data: { content: 'snapshot test' } }]]))

      const bridge = createInferenceBridge({ adapter })
      const result = await bridge.execute(createTestRequest())

      for (const snapshot of result.trajectory.snapshots) {
        expect(snapshot.snapshotId).toMatch(/^snap_/)
        expect(snapshot.requestId).toBe('test-req-1')
        expect(snapshot.timestamp).toBeGreaterThan(0)
        expect(['selection', 'deadlock', 'feedback_error', 'extension_error']).toContain(snapshot.kind)
        expect(snapshot.data).toBeDefined()
      }
    })

    test('events have required fields for replay', async () => {
      const adapter = createFakeAdapter(new Map([['test-req-1', { data: { content: 'replay test' } }]]))

      const bridge = createInferenceBridge({ adapter })
      const result = await bridge.execute(createTestRequest())

      for (const event of result.trajectory.events) {
        expect(event.type).toMatch(/^inference:/)
        expect(event.timestamp).toBeGreaterThan(0)
        expect(event.requestId).toBe('test-req-1')
        expect(event.detail).toBeDefined()
        expect(event.detail.type).toBe(event.type)
      }
    })

    test('success outcome includes response data', async () => {
      const adapter = createFakeAdapter(
        new Map([
          [
            'test-req-1',
            {
              data: {
                content: 'Success response data',
                usage: { inputTokens: 10, outputTokens: 20 },
              },
            },
          ],
        ]),
      )

      const bridge = createInferenceBridge({ adapter })
      const result = await bridge.execute(createTestRequest())

      expect(result.trajectory.outcome.status).toBe('success')
      if (result.trajectory.outcome.status === 'success') {
        expect(result.trajectory.outcome.response.data.content).toBe('Success response data')
        expect(result.trajectory.outcome.response.data.usage).toEqual({
          inputTokens: 10,
          outputTokens: 20,
        })
      }
    })

    test('error outcome includes error details', async () => {
      const adapter = createFakeAdapter(new Map([['test-req-1', new Error('Model hallucination detected')]]))

      const bridge = createInferenceBridge({ adapter })
      const result = await bridge.execute(createTestRequest())

      expect(result.trajectory.outcome.status).toBe('error')
      if (result.trajectory.outcome.status === 'error') {
        expect(result.trajectory.outcome.error.requestId).toBe('test-req-1')
        expect(result.trajectory.outcome.error.message).toBe('Model hallucination detected')
      }
    })

    test('blocked outcome includes reason', async () => {
      const blockingPolicy: InferencePolicy = {
        evaluate: () => false,
      }

      const adapter = createFakeAdapter(new Map())
      const bridge = createInferenceBridge({ adapter, policy: blockingPolicy })
      const result = await bridge.execute(createTestRequest())

      expect(result.trajectory.outcome.status).toBe('blocked')
      if (result.trajectory.outcome.status === 'blocked') {
        expect(typeof result.trajectory.outcome.reason).toBe('string')
        expect(result.trajectory.outcome.reason.length).toBeGreaterThan(0)
      }
    })
  })
})
