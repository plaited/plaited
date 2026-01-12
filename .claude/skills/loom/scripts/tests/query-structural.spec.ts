import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

const scriptsDir = join(import.meta.dir, '..')

describe('query-structural', () => {
  test('returns all topics when no args provided', async () => {
    const result = await Bun.$`bun ${scriptsDir}/query-structural.ts`.json()

    expect(result.topics).toHaveLength(5)
    expect(result.topics.map((t: { topic: string }) => t.topic)).toEqual([
      'objects',
      'channels',
      'levers',
      'loops',
      'blocks',
    ])
    expect(result.summary).toContain('5 structural reference')
  })

  test('returns single topic when specified', async () => {
    const result = await Bun.$`bun ${scriptsDir}/query-structural.ts channels`.json()

    expect(result.topics).toHaveLength(1)
    expect(result.topics[0].topic).toBe('channels')
    expect(result.topics[0].content).toContain('# Channels')
    expect(result.summary).toBe('Retrieved 1 structural reference(s): channels')
  })

  test('returns multiple topics when specified', async () => {
    const result = await Bun.$`bun ${scriptsDir}/query-structural.ts objects levers`.json()

    expect(result.topics).toHaveLength(2)
    expect(result.topics.map((t: { topic: string }) => t.topic)).toEqual(['objects', 'levers'])
    expect(result.summary).toBe('Retrieved 2 structural reference(s): objects, levers')
  })

  test('includes file paths in response', async () => {
    const result = await Bun.$`bun ${scriptsDir}/query-structural.ts loops`.json()

    expect(result.topics[0].path).toEndWith('references/structural/loops.md')
  })

  test('exits with error on invalid topic', async () => {
    const proc = Bun.spawn(['bun', `${scriptsDir}/query-structural.ts`, 'invalid-topic'], {
      stderr: 'pipe',
    })

    const exitCode = await proc.exited
    const stderr = await new Response(proc.stderr).text()

    expect(exitCode).toBe(1)
    expect(stderr).toContain('Invalid topics: invalid-topic')
    expect(stderr).toContain('Valid topics:')
  })

  test('filters out invalid topics from mixed args', async () => {
    const proc = Bun.spawn(['bun', `${scriptsDir}/query-structural.ts`, 'channels', 'invalid'], {
      stderr: 'pipe',
    })

    const exitCode = await proc.exited
    expect(exitCode).toBe(1)
  })

  test('content includes type contracts for channels', async () => {
    const result = await Bun.$`bun ${scriptsDir}/query-structural.ts channels`.json()

    expect(result.topics[0].content).toContain('SelectionChannel')
    expect(result.topics[0].content).toContain('Provider Agnostic')
  })

  test('content includes bThread patterns for levers', async () => {
    const result = await Bun.$`bun ${scriptsDir}/query-structural.ts levers`.json()

    expect(result.topics[0].content).toContain('Game')
    expect(result.topics[0].content).toContain('bThread')
  })
})
