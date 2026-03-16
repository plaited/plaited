/**
 * Tests for the SensorFactory contract and git sensor reference implementation.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import type { SensorSnapshot } from '../agent.types.ts'
import { createGitSensor, type GitSensorData, type GitSensorDelta } from '../sensors/git.ts'
import { runSensorSweep } from '../proactive.ts'

// ============================================================================
// Helpers
// ============================================================================

/** Create a temporary directory for test isolation. */
const makeTempDir = async (prefix: string) => mkdtemp(join(tmpdir(), `plaited-test-${prefix}-`))

/** Initialize a git repo in a directory with an initial commit. */
const initGitRepo = async (dir: string) => {
  await Bun.$`git init`.cwd(dir).quiet()
  await Bun.$`git config user.email "test@test.com"`.cwd(dir).quiet()
  await Bun.$`git config user.name "Test"`.cwd(dir).quiet()
  await Bun.write(join(dir, 'README.md'), '# Test')
  await Bun.$`git add .`.cwd(dir).quiet()
  await Bun.$`git commit -m "initial commit"`.cwd(dir).quiet()
}

// ============================================================================
// Git Sensor — read()
// ============================================================================

describe('createGitSensor', () => {
  let repoDir: string

  afterEach(async () => {
    if (repoDir) await rm(repoDir, { recursive: true, force: true })
  })

  test('read() returns HEAD sha, commits, and status', async () => {
    repoDir = await makeTempDir('git-read')
    await initGitRepo(repoDir)

    const sensor = createGitSensor(repoDir)
    const data = (await sensor.read(AbortSignal.timeout(5_000))) as GitSensorData

    expect(data.headSha).toBeTruthy()
    expect(data.headSha.length).toBeGreaterThanOrEqual(7)
    expect(data.commits).toHaveLength(1)
    expect(data.commits[0]).toContain('initial commit')
    expect(data.status).toHaveLength(0)
  })

  test('read() captures untracked files in status', async () => {
    repoDir = await makeTempDir('git-status')
    await initGitRepo(repoDir)

    // Create an untracked file
    await Bun.write(join(repoDir, 'new-file.ts'), 'export const x = 1')

    const sensor = createGitSensor(repoDir)
    const data = (await sensor.read(AbortSignal.timeout(5_000))) as GitSensorData

    expect(data.status.length).toBeGreaterThanOrEqual(1)
    expect(data.status.some((s) => s.includes('new-file.ts'))).toBe(true)
  })

  // ============================================================================
  // Git Sensor — diff()
  // ============================================================================

  test('diff() returns all data on first run (no previous)', () => {
    const sensor = createGitSensor()
    const current: GitSensorData = {
      headSha: 'abc1234',
      commits: ['abc1234 initial commit'],
      status: [],
    }

    const delta = sensor.diff(current, null) as GitSensorDelta

    expect(delta).not.toBeNull()
    expect(delta.newCommits).toEqual(['abc1234 initial commit'])
    expect(delta.statusChanges).toHaveLength(0)
  })

  test('diff() detects new commits', () => {
    const sensor = createGitSensor()

    const previous: SensorSnapshot = {
      timestamp: '2026-01-01T00:00:00.000Z',
      data: {
        headSha: 'abc1234',
        commits: ['abc1234 first commit'],
        status: [],
      } satisfies GitSensorData,
    }

    const current: GitSensorData = {
      headSha: 'def5678',
      commits: ['def5678 second commit', 'abc1234 first commit'],
      status: [],
    }

    const delta = sensor.diff(current, previous) as GitSensorDelta

    expect(delta).not.toBeNull()
    expect(delta.newCommits).toEqual(['def5678 second commit'])
    expect(delta.statusChanges).toHaveLength(0)
  })

  test('diff() returns null when nothing changed', () => {
    const sensor = createGitSensor()

    const data: GitSensorData = {
      headSha: 'abc1234',
      commits: ['abc1234 initial commit'],
      status: [],
    }

    const previous: SensorSnapshot = {
      timestamp: '2026-01-01T00:00:00.000Z',
      data,
    }

    const delta = sensor.diff(data, previous)
    expect(delta).toBeNull()
  })

  test('diff() detects status changes', () => {
    const sensor = createGitSensor()

    const previous: SensorSnapshot = {
      timestamp: '2026-01-01T00:00:00.000Z',
      data: {
        headSha: 'abc1234',
        commits: ['abc1234 initial commit'],
        status: ['M  file.ts'],
      } satisfies GitSensorData,
    }

    const current: GitSensorData = {
      headSha: 'abc1234',
      commits: ['abc1234 initial commit'],
      status: ['M  file.ts', '?? new.ts'],
    }

    const delta = sensor.diff(current, previous) as GitSensorDelta

    expect(delta).not.toBeNull()
    expect(delta.newCommits).toHaveLength(0)
    expect(delta.statusChanges).toContain('?? new.ts')
  })

  test('diff() detects removed status entries', () => {
    const sensor = createGitSensor()

    const previous: SensorSnapshot = {
      timestamp: '2026-01-01T00:00:00.000Z',
      data: {
        headSha: 'abc1234',
        commits: ['abc1234 initial commit'],
        status: ['M  file.ts', '?? old.ts'],
      } satisfies GitSensorData,
    }

    const current: GitSensorData = {
      headSha: 'abc1234',
      commits: ['abc1234 initial commit'],
      status: ['M  file.ts'],
    }

    const delta = sensor.diff(current, previous) as GitSensorDelta

    expect(delta).not.toBeNull()
    expect(delta.statusChanges).toContain('-?? old.ts')
  })

  test('snapshotPath is relative to sensors directory', () => {
    const sensor = createGitSensor()
    expect(sensor.snapshotPath).toBe('git.json')
  })
})

// ============================================================================
// Snapshot Persistence (via runSensorSweep)
// ============================================================================

describe('runSensorSweep', () => {
  let memoryDir: string

  afterEach(async () => {
    if (memoryDir) await rm(memoryDir, { recursive: true, force: true })
  })

  test('saves snapshot to disk after sensor read', async () => {
    memoryDir = await makeTempDir('sweep-save')

    const sensor = createGitSensor(process.cwd())
    await runSensorSweep([sensor], memoryDir, AbortSignal.timeout(10_000))

    // Verify snapshot was written
    const snapshotFile = Bun.file(join(memoryDir, 'sensors', 'git.json'))
    expect(await snapshotFile.exists()).toBe(true)

    const snapshot = (await snapshotFile.json()) as SensorSnapshot
    expect(snapshot.timestamp).toBeTruthy()
    expect(snapshot.data).toBeDefined()

    const data = snapshot.data as GitSensorData
    expect(data.headSha).toBeTruthy()
    expect(Array.isArray(data.commits)).toBe(true)
  })

  test('loads previous snapshot for diff comparison', async () => {
    memoryDir = await makeTempDir('sweep-load')

    const sensor = createGitSensor(process.cwd())

    // First sweep — no previous snapshot, should detect changes
    const first = await runSensorSweep([sensor], memoryDir, AbortSignal.timeout(10_000))
    expect(first.length).toBeGreaterThanOrEqual(1)

    // Second sweep — same state, should detect no changes
    const second = await runSensorSweep([sensor], memoryDir, AbortSignal.timeout(10_000))
    expect(second).toHaveLength(0)
  })

  test('snapshot round-trips correctly through JSON', async () => {
    memoryDir = await makeTempDir('sweep-roundtrip')

    const sensor = createGitSensor(process.cwd())
    await runSensorSweep([sensor], memoryDir, AbortSignal.timeout(10_000))

    // Read the saved snapshot
    const snapshotPath = join(memoryDir, 'sensors', 'git.json')
    const saved = (await Bun.file(snapshotPath).json()) as SensorSnapshot

    // Verify the snapshot can be used for diff
    const currentData = await sensor.read(AbortSignal.timeout(5_000))
    const delta = sensor.diff(currentData, saved)

    // Same state → null delta
    expect(delta).toBeNull()
  })

  test('handles sensor read errors gracefully', async () => {
    memoryDir = await makeTempDir('sweep-error')

    const failingSensor = {
      name: 'failing',
      read: async () => {
        throw new Error('sensor failed')
      },
      diff: () => null,
      snapshotPath: 'failing.json',
    }

    const results = await runSensorSweep([failingSensor], memoryDir, AbortSignal.timeout(5_000))
    expect(results).toHaveLength(0)

    // No snapshot should be saved for a failing sensor
    const snapshotFile = Bun.file(join(memoryDir, 'sensors', 'failing.json'))
    expect(await snapshotFile.exists()).toBe(false)
  })

  test('runs multiple sensors in parallel', async () => {
    memoryDir = await makeTempDir('sweep-parallel')

    const sensorA = {
      name: 'alpha',
      read: async () => ({ value: 'a' }),
      diff: (_current: unknown, previous: SensorSnapshot | null) => (previous ? null : { changed: true }),
      snapshotPath: 'alpha.json',
    }

    const sensorB = {
      name: 'beta',
      read: async () => ({ value: 'b' }),
      diff: (_current: unknown, previous: SensorSnapshot | null) => (previous ? null : { changed: true }),
      snapshotPath: 'beta.json',
    }

    const results = await runSensorSweep([sensorA, sensorB], memoryDir, AbortSignal.timeout(5_000))

    // Both should report deltas on first run
    expect(results).toHaveLength(2)
    expect(results.map((r) => r.sensor).sort()).toEqual(['alpha', 'beta'])

    // Both snapshots should be saved
    expect(await Bun.file(join(memoryDir, 'sensors', 'alpha.json')).exists()).toBe(true)
    expect(await Bun.file(join(memoryDir, 'sensors', 'beta.json')).exists()).toBe(true)
  })
})
