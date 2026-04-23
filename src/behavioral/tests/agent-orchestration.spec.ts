import { describe, expect, test } from 'bun:test'
import type { SnapshotMessage } from '../behavioral.schemas.ts'
import { behavioral, onType, onTypeWhere, sync, thread } from './helpers.ts'

describe('orchestrator routing', () => {
  test('routes tasks to project handlers', () => {
    const log: string[] = []
    const handlers = new Map<string, () => void>()
    const { addBThreads, trigger, useFeedback } = behavioral()

    addBThreads({
      oneAtATime: thread(
        [sync({ waitFor: onType('dispatch') }), sync({ waitFor: onType('project_result'), block: onType('dispatch') })],
        true,
      ),
    })

    useFeedback({
      route(detail) {
        log.push(`route:${detail.project}`)
        trigger({ type: 'dispatch', detail })
      },
      dispatch(detail) {
        log.push(`dispatch:${detail.project}`)
        handlers.get(detail.project)?.()
      },
      project_result(detail) {
        log.push(`result:${detail.project}`)
      },
    })

    handlers.set('alpha', () => trigger({ type: 'project_result', detail: { project: 'alpha' } }))
    handlers.set('beta', () => trigger({ type: 'project_result', detail: { project: 'beta' } }))

    trigger({ type: 'route', detail: { project: 'alpha' } })
    trigger({ type: 'route', detail: { project: 'beta' } })

    expect(log).toEqual(['route:alpha', 'dispatch:alpha', 'result:alpha', 'route:beta', 'dispatch:beta', 'result:beta'])
  })
})

describe('snapshot observability', () => {
  test('deadlock snapshots include blocked attribution', () => {
    const snapshots: SnapshotMessage[] = []
    const { addBThreads, trigger, useSnapshot } = behavioral()

    useSnapshot((snapshot) => {
      snapshots.push(snapshot)
    })

    addBThreads({
      safety: thread([sync({ block: onType('dangerous') })], true),
      requester: thread([sync({ request: { type: 'dangerous' } })]),
    })

    trigger({ type: 'kickoff' })

    const deadlock = snapshots.find((snapshot) => snapshot.kind === 'deadlock')
    expect(deadlock).toBeDefined()
  })
})

describe('additive constitution rules', () => {
  test('multiple independent block rules compose', () => {
    const log: string[] = []
    const { addBThreads, trigger, useFeedback } = behavioral()

    addBThreads({
      noEtcWrites: thread(
        [
          sync({
            block: onTypeWhere({
              type: 'execute',
              predicate: (detail) => {
                const parsed = detail as { tool?: string; path?: string } | undefined
                return parsed?.tool === 'write_file' && Boolean(parsed.path?.startsWith('/etc/'))
              },
            }),
          }),
        ],
        true,
      ),
      noDeleteFile: thread(
        [
          sync({
            block: onTypeWhere({
              type: 'execute',
              predicate: (detail) => (detail as { tool?: string } | undefined)?.tool === 'delete_file',
            }),
          }),
        ],
        true,
      ),
    })

    useFeedback({
      execute(detail) {
        log.push(`execute:${detail.tool}:${detail.path ?? ''}`)
      },
    })

    trigger({ type: 'execute', detail: { tool: 'write_file', path: '/app/config.json' } })
    trigger({ type: 'execute', detail: { tool: 'write_file', path: '/etc/passwd' } })
    trigger({ type: 'execute', detail: { tool: 'delete_file', path: '/app/config.json' } })

    expect(log).toEqual(['execute:write_file:/app/config.json'])
  })
})
