import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

    agent.trigger({ type: 'custom_event' })

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

    agent.trigger({ type: AGENT_CORE_EVENTS.agent_disconnect })

    expect(snapshots).toContain('restricted_trigger_error')
  })

  test('installs factory modules at runtime through update_factories', async () => {
    const seen: string[] = []
    const moduleUrl = new URL('./fixtures/update-factories.fixture.ts', import.meta.url).href
    let resolvePong!: () => void
    const pongSeen = new Promise<void>((resolve) => {
      resolvePong = resolve
    })

    const agent = await createAgent({
      id: 'agent:test',
      factories: [
        () => ({
          handlers: {
            fixture_pong() {
              seen.push('fixture_pong')
              resolvePong()
            },
          },
        }),
      ],
    })

    agent.trigger({
      type: AGENT_CORE_EVENTS.update_factories,
      detail: { module: moduleUrl },
    })

    for (let attempt = 0; attempt < 10 && seen.length === 0; attempt++) {
      await Bun.sleep(10)
      agent.trigger({ type: 'fixture_ping' })
    }

    await pongSeen

    expect(seen).toEqual(['fixture_pong'])
  })

  test('executes built-in CRUD through core tool events using cwd context', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'plaited-agent-tool-'))
    await Bun.write(`${workspace}/hello.txt`, 'hello from agent')

    let resolveResult!: (result: { result: { output?: unknown } }) => void
    const resultSeen = new Promise<{ result: { output?: unknown } }>((resolve) => {
      resolveResult = resolve
    })

    const agent = await createAgent({
      id: 'agent:tools',
      cwd: workspace,
      factories: [
        () => ({
          handlers: {
            [AGENT_CORE_EVENTS.agent_tool_result](detail) {
              resolveResult(detail as { result: { output?: unknown } })
            },
          },
        }),
      ],
    })

    agent.trigger({
      type: AGENT_CORE_EVENTS.read_file,
      detail: { path: 'hello.txt' },
    })

    const detail = await resultSeen
    expect(detail.result.output).toEqual({
      type: 'text',
      path: 'hello.txt',
      content: 'hello from agent',
      truncated: false,
      totalBytes: 16,
      totalLines: 1,
      outputLines: 1,
    })

    await rm(workspace, { recursive: true, force: true })
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

    spawned.trigger({ type: AGENT_CORE_EVENTS.agent_disconnect })

    expect(spawned.id).toBe('agent:spawned')
    expect(typeof spawned.disconnectSnapshot).toBe('function')
    expect(snapshots).toContain('restricted_trigger_error')
  })
})
