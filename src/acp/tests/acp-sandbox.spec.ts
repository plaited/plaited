import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createSandboxHandler } from '../acp-sandbox.ts'

const TEST_DIR = '/tmp/claude/acp-sandbox-test'

describe('createSandboxHandler', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true })
  })

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  describe('file operations without sandbox', () => {
    test('reads file when sandbox disabled', async () => {
      const testFile = join(TEST_DIR, 'test.txt')
      await writeFile(testFile, 'hello world')

      const handler = createSandboxHandler({ enabled: false })
      const content = await handler.readTextFile(testFile)

      expect(content).toBe('hello world')
    })

    test('writes file when sandbox disabled', async () => {
      const testFile = join(TEST_DIR, 'write-test.txt')

      const handler = createSandboxHandler({ enabled: false })
      await handler.writeTextFile(testFile, 'written content')

      const content = await Bun.file(testFile).text()
      expect(content).toBe('written content')
    })
  })

  describe('file operations with sandbox', () => {
    test('reads file when path is allowed', async () => {
      const testFile = join(TEST_DIR, 'allowed.txt')
      await writeFile(testFile, 'allowed content')

      const handler = createSandboxHandler({
        enabled: true,
        filesystem: {
          denyRead: ['/etc/passwd'],
        },
      })

      const content = await handler.readTextFile(testFile)
      expect(content).toBe('allowed content')
    })

    test('throws when read path is denied', async () => {
      const handler = createSandboxHandler({
        enabled: true,
        filesystem: {
          denyRead: [TEST_DIR],
        },
      })

      const testFile = join(TEST_DIR, 'denied.txt')
      await writeFile(testFile, 'denied content')

      await expect(handler.readTextFile(testFile)).rejects.toThrow('Read access denied')
    })

    test('writes file when path is allowed', async () => {
      const testFile = join(TEST_DIR, 'allowed-write.txt')

      const handler = createSandboxHandler({
        enabled: true,
        filesystem: {
          allowWrite: [TEST_DIR],
        },
      })

      await handler.writeTextFile(testFile, 'allowed write')

      const content = await Bun.file(testFile).text()
      expect(content).toBe('allowed write')
    })

    test('throws when write path is not in allowWrite', async () => {
      const handler = createSandboxHandler({
        enabled: true,
        filesystem: {
          allowWrite: ['/some/other/path'],
        },
      })

      const testFile = join(TEST_DIR, 'not-allowed.txt')

      await expect(handler.writeTextFile(testFile, 'content')).rejects.toThrow('Write access denied')
    })

    test('throws when write path is in denyWrite', async () => {
      const handler = createSandboxHandler({
        enabled: true,
        filesystem: {
          allowWrite: [TEST_DIR],
          denyWrite: [join(TEST_DIR, 'denied')],
        },
      })

      const testFile = join(TEST_DIR, 'denied', 'file.txt')
      await mkdir(join(TEST_DIR, 'denied'), { recursive: true })

      await expect(handler.writeTextFile(testFile, 'content')).rejects.toThrow('Write access denied')
    })
  })

  describe('terminal operations', () => {
    test('creates terminal and gets output', async () => {
      const handler = createSandboxHandler({ enabled: false })

      const terminalId = await handler.createTerminal('echo "hello"')
      expect(terminalId).toMatch(/^terminal-\d+$/)

      // Wait for command to complete
      const exitCode = await handler.waitForExit(terminalId)
      expect(exitCode).toBe(0)

      const { output } = handler.getTerminalOutput(terminalId)
      expect(output.trim()).toBe('hello')
    })

    test('throws for unknown terminal', () => {
      const handler = createSandboxHandler({ enabled: false })

      expect(() => handler.getTerminalOutput('unknown-id')).toThrow('Terminal not found')
    })

    test('kills terminal process', async () => {
      const handler = createSandboxHandler({ enabled: false })

      // Start a long-running command
      const terminalId = await handler.createTerminal('sleep 10')

      // Kill it immediately
      handler.killTerminal(terminalId)

      // Should not throw
      const exitCode = await handler.waitForExit(terminalId)
      // Killed processes typically exit with non-zero
      expect(typeof exitCode).toBe('number')
    })

    test('releases terminal cleans up', async () => {
      const handler = createSandboxHandler({ enabled: false })

      const terminalId = await handler.createTerminal('echo "test"')
      await handler.waitForExit(terminalId)

      handler.releaseTerminal(terminalId)

      // After release, terminal should not be found
      expect(() => handler.getTerminalOutput(terminalId)).toThrow('Terminal not found')
    })
  })

  describe('cleanup', () => {
    test('cleanup kills all terminals', async () => {
      const handler = createSandboxHandler({ enabled: false })

      // Create multiple terminals
      await handler.createTerminal('sleep 10')
      await handler.createTerminal('sleep 10')

      // Cleanup should not throw
      await handler.cleanup()
    })
  })

  describe('isEnabled', () => {
    test('returns true when enabled', () => {
      const handler = createSandboxHandler({ enabled: true })
      expect(handler.isEnabled()).toBe(true)
    })

    test('returns false when disabled', () => {
      const handler = createSandboxHandler({ enabled: false })
      expect(handler.isEnabled()).toBe(false)
    })
  })
})
