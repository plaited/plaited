import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { $ } from 'bun'

const scriptsDir = join(import.meta.dir, '..')
const scriptPath = join(scriptsDir, 'install-workshop.sh')
const tmpDir = '/tmp/claude/install-workshop-test'

beforeAll(async () => {
  await mkdir(tmpDir, { recursive: true })
})

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

describe('install-workshop.sh', () => {
  describe('--help', () => {
    test('shows usage information', async () => {
      const result = await $`bash ${scriptPath} --help`.text()

      expect(result).toContain('Usage: install-workshop.sh')
      expect(result).toContain('--agent')
      expect(result).toContain('--update')
      expect(result).toContain('--uninstall')
    })

    test('lists all supported agents', async () => {
      const result = await $`bash ${scriptPath} --help`.text()

      expect(result).toContain('claude')
      expect(result).toContain('cursor')
      expect(result).toContain('opencode')
      expect(result).toContain('amp')
      expect(result).toContain('goose')
      expect(result).toContain('factory')
    })

    test('shows examples', async () => {
      const result = await $`bash ${scriptPath} --help`.text()

      expect(result).toContain('Examples:')
      expect(result).toContain('./install-workshop.sh --agent claude')
    })

    test('exits with code 0', async () => {
      const proc = Bun.spawn(['bash', scriptPath, '--help'], {
        stdout: 'pipe',
      })
      const exitCode = await proc.exited

      expect(exitCode).toBe(0)
    })
  })

  describe('--agent validation', () => {
    test('rejects unknown agent', async () => {
      const testDir = join(tmpDir, 'unknown-agent')
      await mkdir(testDir, { recursive: true })

      const proc = Bun.spawn(['bash', scriptPath, '--agent', 'unknown'], {
        cwd: testDir,
        stderr: 'pipe',
      })
      const exitCode = await proc.exited
      const stderr = await new Response(proc.stderr).text()

      expect(exitCode).toBe(1)
      expect(stderr).toContain('Unknown agent')
    })
  })

  describe('--uninstall without installation', () => {
    test('fails when no installation detected', async () => {
      const testDir = join(tmpDir, 'empty-project')
      await mkdir(testDir, { recursive: true })

      const proc = Bun.spawn(['bash', scriptPath, '--uninstall'], {
        cwd: testDir,
        stderr: 'pipe',
      })
      const exitCode = await proc.exited
      const stderr = await new Response(proc.stderr).text()

      expect(exitCode).toBe(1)
      expect(stderr).toContain('No existing installation detected')
    })
  })

  describe('--update without installation', () => {
    test('fails when no installation detected', async () => {
      const testDir = join(tmpDir, 'empty-project-update')
      await mkdir(testDir, { recursive: true })

      const proc = Bun.spawn(['bash', scriptPath, '--update'], {
        cwd: testDir,
        stderr: 'pipe',
      })
      const exitCode = await proc.exited
      const stderr = await new Response(proc.stderr).text()

      expect(exitCode).toBe(1)
      expect(stderr).toContain('No existing installation detected')
    })
  })

  describe('unknown option', () => {
    test('rejects unknown options', async () => {
      const proc = Bun.spawn(['bash', scriptPath, '--invalid-option'], {
        stderr: 'pipe',
      })
      const exitCode = await proc.exited
      const stderr = await new Response(proc.stderr).text()

      expect(exitCode).toBe(1)
      expect(stderr).toContain('Unknown option')
    })
  })

  describe('agent detection', () => {
    test('detects .claude directory as claude agent', async () => {
      const testDir = join(tmpDir, 'claude-detection')
      await mkdir(join(testDir, '.claude'), { recursive: true })

      // Run update to trigger detection (will fail but detection message shows)
      const proc = Bun.spawn(['bash', scriptPath, '--update'], {
        cwd: testDir,
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const stdout = await new Response(proc.stdout).text()

      // Should detect claude and try to update
      expect(stdout).toContain('Updating installation for: claude')
    })

    test('detects .opencode directory as opencode agent', async () => {
      const testDir = join(tmpDir, 'opencode-detection')
      await mkdir(join(testDir, '.opencode'), { recursive: true })

      const proc = Bun.spawn(['bash', scriptPath, '--update'], {
        cwd: testDir,
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const stdout = await new Response(proc.stdout).text()

      expect(stdout).toContain('Updating installation for: opencode')
    })

    test('detects .agents directory as amp agent', async () => {
      const testDir = join(tmpDir, 'amp-detection')
      await mkdir(join(testDir, '.agents'), { recursive: true })

      const proc = Bun.spawn(['bash', scriptPath, '--update'], {
        cwd: testDir,
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const stdout = await new Response(proc.stdout).text()

      expect(stdout).toContain('Updating installation for: amp')
    })

    test('detects .factory directory as factory agent', async () => {
      const testDir = join(tmpDir, 'factory-detection')
      await mkdir(join(testDir, '.factory'), { recursive: true })

      const proc = Bun.spawn(['bash', scriptPath, '--update'], {
        cwd: testDir,
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const stdout = await new Response(proc.stdout).text()

      expect(stdout).toContain('Updating installation for: factory')
    })
  })

  describe('header output', () => {
    test('shows Plaited Workshop header', async () => {
      const result = await $`bash ${scriptPath} --help`.text()

      expect(result).toContain('Plaited Workshop')
    })
  })
})
