import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSnapshotContextFactory } from '../../factories/create-snapshot-context-factory.ts'
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

  test('installs factory modules at runtime through update_factories', async () => {
    const seen: string[] = []
    const moduleUrl = new URL('./fixtures/update-factories.fixture.ts', import.meta.url).href
    let resolveUpdate!: () => void
    let rejectUpdate!: (error: Error) => void
    const updated = new Promise<void>((resolve, reject) => {
      resolveUpdate = resolve
      rejectUpdate = reject
    })

    const agent = await createAgent({
      id: 'agent:test',
      factories: [
        () => ({
          handlers: {
            [AGENT_CORE_EVENTS.factories_updated](detail) {
              seen.push(`updated:${(detail as { module: string }).module}`)
              resolveUpdate()
            },
            [AGENT_CORE_EVENTS.update_factories_error](detail) {
              rejectUpdate(new Error((detail as { error: string }).error))
            },
            fixture_pong() {
              seen.push('fixture_pong')
            },
          },
        }),
      ],
    })

    agent.restrictedTrigger({
      type: AGENT_CORE_EVENTS.update_factories,
      detail: { module: moduleUrl },
    })

    await updated

    agent.restrictedTrigger({ type: 'fixture_ping' })

    expect(seen).toEqual([`updated:${moduleUrl}`, 'fixture_pong'])
  })

  test('executes runtime SQLite requests through engine handlers', async () => {
    let resolveRows!: (rows: Array<Record<string, unknown>>) => void
    const rowsSeen = new Promise<Array<Record<string, unknown>>>((resolve) => {
      resolveRows = resolve
    })

    const agent = await createAgent({
      id: 'agent:sqlite',
      factories: [
        () => ({
          handlers: {
            [AGENT_CORE_EVENTS.runtime_sql_rows](detail) {
              resolveRows((detail as { rows: Array<Record<string, unknown>> }).rows)
            },
          },
        }),
      ],
    })

    agent.restrictedTrigger({
      type: AGENT_CORE_EVENTS.runtime_sql_run,
      detail: {
        requestId: 'insert-1',
        sql: 'INSERT INTO runtime_snapshots (snapshot_kind, created_at, payload_json) VALUES (?, ?, ?)',
        params: ['selection', '2026-03-29T00:00:00.000Z', '{"kind":"selection"}'],
      },
    })

    agent.restrictedTrigger({
      type: AGENT_CORE_EVENTS.runtime_sql_all,
      detail: {
        requestId: 'select-1',
        sql: 'SELECT snapshot_kind, payload_json FROM runtime_snapshots ORDER BY id ASC',
      },
    })

    const rows = await rowsSeen

    expect(rows).toHaveLength(1)
    expect(rows[0]?.snapshot_kind).toBe('selection')
    expect(rows[0]?.payload_json).toBe('{"kind":"selection"}')
  })

  test('records snapshots into runtime SQLite through the snapshot context factory', async () => {
    let resolveRows!: (rows: Array<Record<string, unknown>>) => void
    const rowsSeen = new Promise<Array<Record<string, unknown>>>((resolve) => {
      resolveRows = resolve
    })

    const agent = await createAgent({
      id: 'agent:snapshots',
      restrictedTriggers: [AGENT_CORE_EVENTS.agent_disconnect],
      factories: [
        createSnapshotContextFactory(),
        () => ({
          handlers: {
            [AGENT_CORE_EVENTS.runtime_sql_rows](detail) {
              resolveRows((detail as { rows: Array<Record<string, unknown>> }).rows)
            },
          },
        }),
      ],
    })

    agent.restrictedTrigger({
      type: AGENT_CORE_EVENTS.agent_disconnect,
    })

    await Bun.sleep(0)

    agent.restrictedTrigger({
      type: AGENT_CORE_EVENTS.runtime_sql_all,
      detail: {
        requestId: 'snapshots-1',
        sql: 'SELECT snapshot_kind, payload_json FROM runtime_snapshots ORDER BY id ASC',
      },
    })

    const rows = await rowsSeen

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.some((row) => row.snapshot_kind === 'restricted_trigger_error')).toBe(true)
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

    agent.restrictedTrigger({
      type: AGENT_CORE_EVENTS.agent_tool_execute,
      detail: {
        toolCall: {
          id: 'tc-1',
          name: 'read_file',
          arguments: { path: 'hello.txt' },
        },
      },
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

    spawned.restrictedTrigger({ type: AGENT_CORE_EVENTS.agent_disconnect })

    expect(spawned.id).toBe('agent:spawned')
    expect(typeof spawned.disconnectSnapshot).toBe('function')
    expect(snapshots).toContain('restricted_trigger_error')
  })
})
