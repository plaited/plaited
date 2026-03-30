import { describe, expect, test } from 'bun:test'

import { AGENT_CORE_EVENTS } from '../agent.constants.ts'
import { createAgent } from '../create-agent.ts'
import { spawnAgent } from '../spawn-agent.ts'

describe('createAgent', () => {
  test('returns the minimal public handle and installs factory handlers', async () => {
    const seen: string[] = []
    const agent = await createAgent({
      id: 'agent:test',
      restrictedTriggers: [AGENT_CORE_EVENTS.agent_disconnect],
      factories: [
        () => ({
          handlers: {
            custom_event() {
              seen.push('custom_event')
            },
          },
        }),
      ],
    })

    agent.restrictedTrigger({ type: 'custom_event' })

    expect(seen).toEqual(['custom_event'])
    expect(typeof agent.useSnapshot).toBe('function')
  })

  test('blocks restricted events through the restricted trigger surface', async () => {
    const snapshots: string[] = []
    const agent = await createAgent({
      id: 'agent:test',
      restrictedTriggers: [AGENT_CORE_EVENTS.agent_disconnect],
    })

    agent.useSnapshot((snapshot) => {
      snapshots.push(snapshot.kind)
    })

    agent.restrictedTrigger({ type: AGENT_CORE_EVENTS.agent_disconnect })

    expect(snapshots).toContain('restricted_trigger_error')
  })
})

describe('spawnAgent', () => {
  test('attaches an optional snapshot listener for the spawner', async () => {
    const snapshots: string[] = []
    const spawned = await spawnAgent({
      id: 'agent:spawned',
      restrictedTriggers: [AGENT_CORE_EVENTS.agent_disconnect],
      onSnapshot(snapshot) {
        snapshots.push(snapshot.kind)
      },
    })

    spawned.restrictedTrigger({ type: AGENT_CORE_EVENTS.agent_disconnect })

    expect(spawned.id).toBe('agent:spawned')
    expect(typeof spawned.disconnectSnapshot).toBe('function')
    expect(snapshots).toContain('restricted_trigger_error')
  })
})
