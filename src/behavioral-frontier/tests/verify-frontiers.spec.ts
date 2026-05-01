import { describe, expect, test } from 'bun:test'

import type { Spec } from '../../behavioral.ts'
import { verifyFrontiers } from '../verify-frontiers.ts'

const onType = (type: string) => ({ type })

const deadlockReachableSpecs = (): Spec[] => [
  {
    label: 'chooseA',
    thread: {
      once: true,
      syncPoints: [{ request: { type: 'A' } }],
    },
  },
  {
    label: 'chooseB',
    thread: {
      once: true,
      syncPoints: [{ request: { type: 'B' } }],
    },
  },
  {
    label: 'deadlockAfterA',
    thread: {
      once: true,
      syncPoints: [{ waitFor: [onType('A')] }, { block: [onType('B')] }],
    },
  },
]

describe('verifyFrontiers', () => {
  test('returns failed when findings exist', () => {
    const result = verifyFrontiers({
      specs: deadlockReachableSpecs(),
    })

    expect(result.status).toBe('failed')
    expect(result.findings).toHaveLength(1)
    expect(result.report.truncated).toBe(false)
  })

  test('returns truncated when exploration stops at maxDepth with no findings', () => {
    const result = verifyFrontiers({
      specs: [
        {
          label: 'tick',
          thread: {
            syncPoints: [{ request: { type: 'tick' } }],
          },
        },
      ],
      maxDepth: 0,
    })

    expect(result.status).toBe('truncated')
    expect(result.findings).toEqual([])
  })

  test('returns verified when exploration completes with no findings', () => {
    const result = verifyFrontiers({
      specs: [
        {
          label: 'watcher',
          thread: {
            once: true,
            syncPoints: [{ waitFor: [onType('ping')] }],
          },
        },
      ],
    })

    expect(result.status).toBe('verified')
    expect(result.findings).toEqual([])
  })

  test('returns truncated when maxDepth cuts only trigger successors', () => {
    const result = verifyFrontiers({
      specs: [
        {
          label: 'watcher',
          thread: {
            once: true,
            syncPoints: [{ waitFor: [onType('ping')] }, { request: { type: 'ack' } }],
          },
        },
        {
          label: 'blockAckAfterPing',
          thread: {
            once: true,
            syncPoints: [{ waitFor: [onType('ping')] }, { block: [onType('ack')] }],
          },
        },
      ],
      triggers: [{ type: 'ping' }],
      maxDepth: 0,
    })

    expect(result.status).toBe('truncated')
    expect(result.findings).toEqual([])
    expect(result.report.truncated).toBe(true)
  })

  test('returns verified when a trigger can escape an internally deadlocked frontier', () => {
    const result = verifyFrontiers({
      specs: [
        {
          label: 'requestAck',
          thread: {
            once: true,
            syncPoints: [{ request: { type: 'ack' } }],
          },
        },
        {
          label: 'blockAckUntilPing',
          thread: {
            once: true,
            syncPoints: [{ block: [onType('ack')], waitFor: [onType('ping')] }],
          },
        },
      ],
      triggers: [{ type: 'ping' }],
      maxDepth: 2,
    })

    expect(result.status).toBe('verified')
    expect(result.findings).toEqual([])
    expect(result.report.truncated).toBe(false)
  })
})
