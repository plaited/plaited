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
      const result = await $`bash ${scriptPath} --help`.quiet()

      expect(result.exitCode).toBe(0)
    })
  })

  describe('--agent validation', () => {
    test('rejects unknown agent', async () => {
      const testDir = join(tmpDir, 'unknown-agent')
      await mkdir(testDir, { recursive: true })

      const result = await $`bash ${scriptPath} --agent unknown`.cwd(testDir).nothrow().quiet()

      expect(result.exitCode).toBe(1)
      expect(result.stderr.toString()).toContain('Unknown agent')
    })
  })

  describe('--uninstall without installation', () => {
    test('fails when no installation detected', async () => {
      const testDir = join(tmpDir, 'empty-project')
      await mkdir(testDir, { recursive: true })

      const result = await $`bash ${scriptPath} --uninstall`.cwd(testDir).nothrow().quiet()

      expect(result.exitCode).toBe(1)
      expect(result.stderr.toString()).toContain('No existing installation detected')
    })
  })

  describe('--update without installation', () => {
    test('fails when no installation detected', async () => {
      const testDir = join(tmpDir, 'empty-project-update')
      await mkdir(testDir, { recursive: true })

      const result = await $`bash ${scriptPath} --update`.cwd(testDir).nothrow().quiet()

      expect(result.exitCode).toBe(1)
      expect(result.stderr.toString()).toContain('No existing installation detected')
    })
  })

  describe('unknown option', () => {
    test('rejects unknown options', async () => {
      const result = await $`bash ${scriptPath} --invalid-option`.nothrow().quiet()

      expect(result.exitCode).toBe(1)
      expect(result.stderr.toString()).toContain('Unknown option')
    })
  })

  describe('agent detection', () => {
    // Helper to run update command and capture stdout before git clone can hang
    // Note: Bun's $ doesn't have .timeout(), so we use spawn + sleep + kill
    const runUpdateAndCapture = async (testDir: string): Promise<string> => {
      const proc = Bun.spawn(['bash', scriptPath, '--update'], {
        cwd: testDir,
        stdout: 'pipe',
        stderr: 'pipe',
      })

      // Detection message prints immediately, kill before git clone hangs
      await Bun.sleep(500)
      proc.kill()

      const stdout = await new Response(proc.stdout).text()
      await proc.exited
      return stdout
    }

    test('detects .claude directory as claude agent', async () => {
      const testDir = join(tmpDir, 'claude-detection')
      await mkdir(join(testDir, '.claude'), { recursive: true })

      const stdout = await runUpdateAndCapture(testDir)

      // Should detect claude and try to update
      expect(stdout).toContain('Updating installation for: claude')
    })

    test('detects .opencode directory as opencode agent', async () => {
      const testDir = join(tmpDir, 'opencode-detection')
      await mkdir(join(testDir, '.opencode'), { recursive: true })

      const stdout = await runUpdateAndCapture(testDir)

      expect(stdout).toContain('Updating installation for: opencode')
    })

    test('detects .agents directory as amp agent', async () => {
      const testDir = join(tmpDir, 'amp-detection')
      await mkdir(join(testDir, '.agents'), { recursive: true })

      const stdout = await runUpdateAndCapture(testDir)

      expect(stdout).toContain('Updating installation for: amp')
    })

    test('detects .factory directory as factory agent', async () => {
      const testDir = join(tmpDir, 'factory-detection')
      await mkdir(join(testDir, '.factory'), { recursive: true })

      const stdout = await runUpdateAndCapture(testDir)

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
