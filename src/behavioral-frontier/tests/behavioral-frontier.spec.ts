import { describe, expect, test } from 'bun:test'
import { join, resolve } from 'node:path'

const CLI_PACKAGE_ROOT = resolve(import.meta.dir, '../../../')

const removedSplitImplementationFiles = [
  'src/behavioral-frontier/explore-frontiers.ts',
  'src/behavioral-frontier/replay-to-frontier.ts',
  'src/behavioral-frontier/verify-frontiers.ts',
]

const createTempRoot = (): string =>
  join('/tmp', `plaited-behavioral-frontier-tests-${Date.now()}-${Math.random().toString(16).slice(2)}`)

const withTempRoot = async (run: (rootDir: string) => Promise<void>): Promise<void> => {
  const rootDir = createTempRoot()
  await Bun.$`mkdir -p ${rootDir}`

  try {
    await run(rootDir)
  } finally {
    await Bun.$`rm -rf ${rootDir}`
  }
}

const runPlaitedCommand = async (args: string[]) =>
  Bun.$`bun ./bin/plaited.ts ${args}`.cwd(CLI_PACKAGE_ROOT).quiet().nothrow()

const runBehavioralFrontierCommand = async (input: unknown) =>
  Bun.$`bun ./bin/plaited.ts behavioral-frontier ${JSON.stringify(input)}`.cwd(CLI_PACKAGE_ROOT).quiet().nothrow()

const onType = (type: string) => ({ type })

const selectionSnapshot = ({
  step = 0,
  type,
  detail,
  ingress,
}: {
  step?: number
  type: string
  detail?: Record<string, unknown>
  ingress?: true
}) => ({
  kind: 'selection',
  step,
  selected: {
    type,
    ...(detail === undefined ? {} : { detail }),
    ...(ingress === undefined ? {} : { ingress }),
  },
})

const frontierSnapshot = ({
  step,
  status,
  candidates,
  enabled,
}: {
  step: number
  status: 'ready' | 'deadlock' | 'idle'
  candidates: Array<{ priority: number; type: string; detail?: Record<string, unknown>; ingress?: true }>
  enabled: Array<{ priority: number; type: string; detail?: Record<string, unknown>; ingress?: true }>
}) => ({
  kind: 'frontier',
  step,
  status,
  candidates,
  enabled,
})

const deadlockSnapshot = ({ step }: { step: number }) => ({
  kind: 'deadlock',
  step,
})

const deadlockReachableSpecs = () => [
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

const branchingSpecs = () => [
  {
    label: 'chooseA',
    thread: {
      once: true,
      syncPoints: [{ request: { type: 'A' } }, { request: { type: 'A1' } }],
    },
  },
  {
    label: 'chooseB',
    thread: {
      once: true,
      syncPoints: [{ request: { type: 'B' } }, { request: { type: 'B1' } }],
    },
  },
]

const selectedTypes = (trace: { snapshotMessages: Array<{ kind: string; selected?: { type?: string } }> }) =>
  trace.snapshotMessages.flatMap((snapshot) =>
    snapshot.kind === 'selection' && snapshot.selected?.type !== undefined ? [snapshot.selected.type] : [],
  )

describe('behavioral-frontier CLI', () => {
  test('keeps behavioral-frontier implementation collapsed into the CLI surface', async () => {
    const existingFiles = []

    for (const filePath of removedSplitImplementationFiles) {
      if (await Bun.file(join(CLI_PACKAGE_ROOT, filePath)).exists()) {
        existingFiles.push(filePath)
      }
    }

    expect(existingFiles).toEqual([])
  })

  test('plaited --schema includes behavioral-frontier', async () => {
    const result = await runPlaitedCommand(['--schema'])

    expect(result.exitCode).toBe(0)
    const manifest = JSON.parse(result.stdout.toString().trim())
    expect(manifest.commands).toContain('behavioral-frontier')
  })

  test('plaited behavioral-frontier --schema input emits inline and specPath branches', async () => {
    const result = await runPlaitedCommand(['behavioral-frontier', '--schema', 'input'])

    expect(result.exitCode).toBe(0)
    const schema = JSON.parse(result.stdout.toString().trim())
    const branches = schema.anyOf ?? schema.oneOf
    expect(Array.isArray(branches)).toBe(true)
    expect(schema.description).toContain('Replay, explore, or verify behavioral frontiers')
    expect(
      branches.some(
        (branch: { properties?: Record<string, unknown>; required?: string[] }) =>
          branch.required?.includes('specs') === true && branch.properties?.specPath === undefined,
      ),
    ).toBe(true)
    expect(
      branches.some(
        (branch: { properties?: Record<string, unknown>; required?: string[] }) =>
          branch.required?.includes('specPath') === true && branch.properties?.specs === undefined,
      ),
    ).toBe(true)
  })

  test('plaited behavioral-frontier --schema output emits replay explore and verify shapes', async () => {
    const result = await runPlaitedCommand(['behavioral-frontier', '--schema', 'output'])

    expect(result.exitCode).toBe(0)
    const schema = JSON.parse(result.stdout.toString().trim())
    expect(schema.oneOf).toHaveLength(3)
  })

  test('mode=replay returns the direct frontier shape', async () => {
    const result = await runBehavioralFrontierCommand({
      mode: 'replay',
      specs: [
        {
          label: 'producer',
          thread: {
            once: true,
            syncPoints: [{ request: { type: 'task' } }],
          },
        },
        {
          label: 'consumer',
          thread: {
            once: true,
            syncPoints: [{ waitFor: [onType('task')] }, { request: { type: 'ack' } }],
          },
        },
      ],
      snapshotMessages: [selectionSnapshot({ type: 'task' })],
    })

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString().trim())
    expect(output).toEqual({
      mode: 'replay',
      snapshotMessages: [selectionSnapshot({ type: 'task' })],
      frontier: frontierSnapshot({
        step: 1,
        status: 'ready',
        candidates: [{ priority: 2, type: 'ack' }],
        enabled: [{ priority: 2, type: 'ack' }],
      }),
    })
  })

  test('mode=replay ignores frontier and deadlock snapshots during replay', async () => {
    const specs = [
      {
        label: 'chooseA',
        thread: {
          once: true,
          syncPoints: [{ request: { type: 'A' } }],
        },
      },
      {
        label: 'watchA',
        thread: {
          once: true,
          syncPoints: [{ waitFor: [onType('A')] }, { request: { type: 'B' } }],
        },
      },
    ]
    const result = await runBehavioralFrontierCommand({
      mode: 'replay',
      specs,
      snapshotMessages: [
        frontierSnapshot({
          step: 0,
          status: 'ready',
          candidates: [{ priority: 1, type: 'A' }],
          enabled: [{ priority: 1, type: 'A' }],
        }),
        selectionSnapshot({ step: 0, type: 'A' }),
        frontierSnapshot({
          step: 1,
          status: 'ready',
          candidates: [{ priority: 2, type: 'B' }],
          enabled: [{ priority: 2, type: 'B' }],
        }),
        deadlockSnapshot({ step: 1 }),
      ],
    })

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString().trim())
    expect(output.frontier).toEqual(
      frontierSnapshot({
        step: 1,
        status: 'ready',
        candidates: [{ priority: 2, type: 'B' }],
        enabled: [{ priority: 2, type: 'B' }],
      }),
    )
  })

  test('mode=replay handles ingress selected events', async () => {
    const result = await runBehavioralFrontierCommand({
      mode: 'replay',
      specs: [
        {
          label: 'watcher',
          thread: {
            once: true,
            syncPoints: [{ waitFor: [onType('ping')] }, { request: { type: 'pong' } }],
          },
        },
      ],
      snapshotMessages: [selectionSnapshot({ type: 'ping', ingress: true })],
    })

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString().trim())
    expect(output.frontier).toEqual(
      frontierSnapshot({
        step: 1,
        status: 'ready',
        candidates: [{ priority: 1, type: 'pong' }],
        enabled: [{ priority: 1, type: 'pong' }],
      }),
    )
  })

  test('mode=replay supports specPath JSONL loading', async () => {
    await withTempRoot(async (rootDir) => {
      const specPath = join(rootDir, 'specs.jsonl')
      await Bun.write(
        specPath,
        `${JSON.stringify({
          label: 'producer',
          thread: {
            once: true,
            syncPoints: [{ request: { type: 'task' } }],
          },
        })}\n`,
      )

      const result = await runBehavioralFrontierCommand({
        mode: 'replay',
        specPath,
      })

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim())
      expect(output.frontier.enabled).toEqual([{ priority: 1, type: 'task' }])
    })
  })

  test('mode=explore appends frontier snapshots to recorded traces', async () => {
    const result = await runBehavioralFrontierCommand({
      mode: 'explore',
      specs: deadlockReachableSpecs(),
      maxDepth: 0,
    })

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString().trim())
    expect(output.traces).toEqual([
      {
        snapshotMessages: [
          frontierSnapshot({
            step: 0,
            status: 'ready',
            candidates: [
              { priority: 1, type: 'A' },
              { priority: 2, type: 'B' },
            ],
            enabled: [
              { priority: 1, type: 'A' },
              { priority: 2, type: 'B' },
            ],
          }),
        ],
      },
    ])
  })

  test('mode=explore orders traces breadth-first with bfs strategy', async () => {
    const result = await runBehavioralFrontierCommand({
      mode: 'explore',
      specs: branchingSpecs(),
      strategy: 'bfs',
      maxDepth: 2,
    })

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString().trim())
    expect(output.traces.map(selectedTypes)).toEqual([
      [],
      ['A'],
      ['B'],
      ['A', 'B'],
      ['A', 'A1'],
      ['B', 'A'],
      ['B', 'B1'],
    ])
  })

  test('mode=explore orders traces depth-first with dfs strategy', async () => {
    const result = await runBehavioralFrontierCommand({
      mode: 'explore',
      specs: branchingSpecs(),
      strategy: 'dfs',
      maxDepth: 2,
    })

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString().trim())
    expect(output.traces.map(selectedTypes)).toEqual([
      [],
      ['B'],
      ['B', 'B1'],
      ['B', 'A'],
      ['A'],
      ['A', 'A1'],
      ['A', 'B'],
    ])
  })

  test('mode=explore explores supplied trigger events as ingress selections', async () => {
    const result = await runBehavioralFrontierCommand({
      mode: 'explore',
      specs: [
        {
          label: 'watcher',
          thread: {
            once: true,
            syncPoints: [{ waitFor: [onType('ping')] }, { request: { type: 'ack' } }],
          },
        },
      ],
      triggers: [{ type: 'ping' }],
      maxDepth: 1,
    })

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString().trim())
    expect(output.traces).toContainEqual({
      snapshotMessages: [
        selectionSnapshot({ step: 0, type: 'ping', ingress: true }),
        frontierSnapshot({
          step: 1,
          status: 'ready',
          candidates: [{ priority: 1, type: 'ack' }],
          enabled: [{ priority: 1, type: 'ack' }],
        }),
      ],
    })
  })

  test('mode=explore maxDepth counts selections instead of total snapshots', async () => {
    const result = await runBehavioralFrontierCommand({
      mode: 'explore',
      specs: deadlockReachableSpecs(),
      snapshotMessages: [
        selectionSnapshot({ step: 0, type: 'B' }),
        frontierSnapshot({
          step: 1,
          status: 'idle',
          candidates: [],
          enabled: [],
        }),
      ],
      maxDepth: 1,
    })

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString().trim())
    expect(output.report).toEqual({
      strategy: 'bfs',
      selectionPolicy: 'all-enabled',
      visitedCount: 1,
      findingCount: 0,
      truncated: true,
      maxDepth: 1,
    })
  })

  test('mode=verify returns failed when findings exist', async () => {
    const result = await runBehavioralFrontierCommand({
      mode: 'verify',
      specs: deadlockReachableSpecs(),
    })

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString().trim())
    expect(output.status).toBe('failed')
    expect(output.findings).toHaveLength(1)
    expect(output.report.truncated).toBe(false)
  })

  test('mode=verify returns truncated when exploration stops at maxDepth with no findings', async () => {
    const result = await runBehavioralFrontierCommand({
      mode: 'verify',
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

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString().trim())
    expect(output.status).toBe('truncated')
    expect(output.findings).toEqual([])
  })

  test('mode=verify returns verified when exploration completes with no findings', async () => {
    const result = await runBehavioralFrontierCommand({
      mode: 'verify',
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

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString().trim())
    expect(output.status).toBe('verified')
    expect(output.findings).toEqual([])
  })

  test('mode=verify returns verified when a trigger can escape an internally deadlocked frontier', async () => {
    const result = await runBehavioralFrontierCommand({
      mode: 'verify',
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

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString().trim())
    expect(output.status).toBe('verified')
    expect(output.findings).toEqual([])
    expect(output.report.truncated).toBe(false)
  })
})
