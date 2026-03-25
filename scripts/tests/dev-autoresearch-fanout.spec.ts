import { describe, expect, test } from 'bun:test'
import { parseInput } from '../dev-autoresearch-fanout.ts'

describe('dev-autoresearch-fanout parseInput', () => {
  test('parses slice, attempts, concurrency, and output flags', () => {
    const parsed = parseInput([
      './dev-research/modnet/slice-23.md',
      '--attempts',
      '30',
      '--concurrency',
      '5',
      '--output-dir',
      './tmp/slice-23-fanout',
      '--strategies-file',
      './dev-research/modnet/slice-23-strategies.txt',
      '--judge',
      '--quiet',
    ])

    expect(parsed.slicePath).toBe('./dev-research/modnet/slice-23.md')
    expect(parsed.attempts).toBe(30)
    expect(parsed.concurrency).toBe(5)
    expect(parsed.outputDir).toBe('./tmp/slice-23-fanout')
    expect(parsed.strategiesFile).toBe('./dev-research/modnet/slice-23-strategies.txt')
    expect(parsed.judge).toBe(true)
    expect(parsed.quiet).toBe(true)
  })
})
