/**
 * Tests for the startup timing utility (mark / printTimings).
 */

import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { mark, printTimings } from '../agent.utils.ts'

describe('timing utility', () => {
  describe('disabled (default)', () => {
    test('mark is a no-op when PLAITED_TIMING is not set', () => {
      // Should not throw
      mark('test-label')
      mark('another-label')
    })

    test('printTimings is a no-op when PLAITED_TIMING is not set', () => {
      // Should not throw
      printTimings()
    })
  })

  describe('enabled (PLAITED_TIMING=1)', () => {
    test('prints timing marks to stderr', () => {
      const script = `
        import { mark, printTimings } from './src/agent/agent.utils.ts'
        mark('step-1')
        await Bun.sleep(5)
        mark('step-2')
        printTimings()
      `

      const result = Bun.spawnSync(['bun', '-e', script], {
        cwd: join(import.meta.dir, '../../..'),
        env: { ...process.env, PLAITED_TIMING: '1' },
        stdout: 'pipe',
        stderr: 'pipe',
      })

      const stderr = result.stderr.toString()
      expect(stderr).toContain('step-1:')
      expect(stderr).toContain('step-2:')
      expect(stderr).toContain('TOTAL:')
      expect(stderr).toMatch(/\d+\.\d+ms/)
    })

    test('does not print when no marks recorded', () => {
      const script = `
        import { printTimings } from './src/agent/agent.utils.ts'
        printTimings()
        process.stderr.write('__sentinel__')
      `

      const result = Bun.spawnSync(['bun', '-e', script], {
        cwd: join(import.meta.dir, '../../..'),
        env: { ...process.env, PLAITED_TIMING: '1' },
        stdout: 'pipe',
        stderr: 'pipe',
      })

      const stderr = result.stderr.toString()
      expect(stderr).toBe('__sentinel__')
    })
  })
})
