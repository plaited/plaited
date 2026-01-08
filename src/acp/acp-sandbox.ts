/**
 * Sandbox handler for ACP client file and terminal operations.
 *
 * @remarks
 * Provides OS-level sandboxing using @anthropic-ai/sandbox-runtime.
 * This is an optional feature - the sandbox-runtime package is a peer dependency.
 *
 * When enabled, the client can safely handle:
 * - `fs/read_text_file` - Read files with path restrictions
 * - `fs/write_text_file` - Write files with path restrictions
 * - `terminal/create` - Execute commands with network/fs restrictions
 */

import { spawn } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import type { SandboxConfig } from './acp.types.ts'

// ============================================================================
// Types
// ============================================================================

/** Terminal process state */
type TerminalProcess = {
  id: string
  process: ReturnType<typeof spawn>
  output: string[]
  exitCode?: number
}

/** Sandbox manager interface (from @anthropic-ai/sandbox-runtime) */
type SandboxManagerType = {
  initialize: (config: SandboxRuntimeConfig) => Promise<void>
  wrapWithSandbox: (command: string) => Promise<string>
  reset: () => Promise<void>
}

/** Sandbox runtime config (from @anthropic-ai/sandbox-runtime) */
type SandboxRuntimeConfig = {
  network?: {
    allowedDomains?: string[]
    deniedDomains?: string[]
    allowUnixSockets?: string[]
    allowLocalBinding?: boolean
  }
  filesystem?: {
    denyRead?: string[]
    allowWrite?: string[]
    denyWrite?: string[]
  }
}

// ============================================================================
// Sandbox Handler
// ============================================================================

/**
 * Creates a sandbox handler for file and terminal operations.
 *
 * @param config - Sandbox configuration
 * @returns Handler object with file and terminal methods
 *
 * @remarks
 * Lazily loads @anthropic-ai/sandbox-runtime to avoid requiring it
 * when sandbox is disabled.
 */
export const createSandboxHandler = (config: SandboxConfig) => {
  let sandboxManager: SandboxManagerType | undefined
  let initialized = false
  const terminals = new Map<string, TerminalProcess>()
  let terminalIdCounter = 0

  /**
   * Initialize the sandbox runtime
   */
  const initialize = async (): Promise<void> => {
    if (initialized || !config.enabled) return

    try {
      // Dynamic import to avoid requiring the package when disabled
      const sandboxModule = await import('@anthropic-ai/sandbox-runtime')
      sandboxManager = sandboxModule.SandboxManager as SandboxManagerType

      const runtimeConfig: SandboxRuntimeConfig = {
        network: config.network,
        filesystem: config.filesystem,
      }

      await sandboxManager.initialize(runtimeConfig)
      initialized = true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') {
        throw new Error(
          'Sandbox enabled but @anthropic-ai/sandbox-runtime not installed. ' +
            'Run: bun add @anthropic-ai/sandbox-runtime',
        )
      }
      throw error
    }
  }

  /**
   * Cleanup sandbox resources
   */
  const cleanup = async (): Promise<void> => {
    // Kill all terminal processes
    for (const terminal of terminals.values()) {
      terminal.process.kill()
    }
    terminals.clear()

    // Reset sandbox manager
    if (sandboxManager && initialized) {
      await sandboxManager.reset()
      initialized = false
    }
  }

  /**
   * Check if a path is allowed for reading
   */
  const isReadAllowed = (path: string): boolean => {
    const denyRead = config.filesystem?.denyRead ?? []
    return !denyRead.some((denied) => path.startsWith(denied) || path.includes(denied))
  }

  /**
   * Check if a path is allowed for writing
   */
  const isWriteAllowed = (path: string): boolean => {
    const allowWrite = config.filesystem?.allowWrite ?? []
    const denyWrite = config.filesystem?.denyWrite ?? []

    // Must be in allowed list
    const allowed = allowWrite.some((allow) => path.startsWith(allow) || path.includes(allow))
    if (!allowed) return false

    // Must not be in deny list
    return !denyWrite.some((denied) => path.startsWith(denied) || path.includes(denied))
  }

  /**
   * Read a text file with sandbox restrictions
   */
  const readTextFile = async (path: string): Promise<string> => {
    if (!config.enabled) {
      return readFile(path, 'utf-8')
    }

    if (!isReadAllowed(path)) {
      throw new Error(`Read access denied for path: ${path}`)
    }

    return readFile(path, 'utf-8')
  }

  /**
   * Write a text file with sandbox restrictions
   */
  const writeTextFile = async (path: string, content: string): Promise<void> => {
    if (!config.enabled) {
      await writeFile(path, content, 'utf-8')
      return
    }

    if (!isWriteAllowed(path)) {
      throw new Error(`Write access denied for path: ${path}`)
    }

    await writeFile(path, content, 'utf-8')
  }

  /**
   * Create a terminal process with sandbox restrictions
   */
  const createTerminal = async (
    command: string,
    options?: { cwd?: string; env?: Record<string, string> },
  ): Promise<string> => {
    await initialize()

    let finalCommand = command

    // Wrap with sandbox if enabled and manager available
    if (config.enabled && sandboxManager) {
      finalCommand = await sandboxManager.wrapWithSandbox(command)
    }

    const terminalId = `terminal-${++terminalIdCounter}`

    const process = spawn(finalCommand, {
      shell: true,
      cwd: options?.cwd,
      env: { ...globalThis.process.env, ...options?.env },
    })

    const terminal: TerminalProcess = {
      id: terminalId,
      process,
      output: [],
    }

    process.stdout?.on('data', (data: Buffer) => {
      terminal.output.push(data.toString())
    })

    process.stderr?.on('data', (data: Buffer) => {
      terminal.output.push(data.toString())
    })

    process.on('exit', (code) => {
      terminal.exitCode = code ?? 0
    })

    terminals.set(terminalId, terminal)

    return terminalId
  }

  /**
   * Get terminal output
   */
  const getTerminalOutput = (terminalId: string): { output: string; exitCode?: number } => {
    const terminal = terminals.get(terminalId)
    if (!terminal) {
      throw new Error(`Terminal not found: ${terminalId}`)
    }

    return {
      output: terminal.output.join(''),
      exitCode: terminal.exitCode,
    }
  }

  /**
   * Wait for terminal to exit
   */
  const waitForExit = async (terminalId: string): Promise<number> => {
    const terminal = terminals.get(terminalId)
    if (!terminal) {
      throw new Error(`Terminal not found: ${terminalId}`)
    }

    if (terminal.exitCode !== undefined) {
      return terminal.exitCode
    }

    return new Promise((resolve) => {
      terminal.process.on('exit', (code) => {
        resolve(code ?? 0)
      })
    })
  }

  /**
   * Kill a terminal process
   */
  const killTerminal = (terminalId: string): void => {
    const terminal = terminals.get(terminalId)
    if (terminal) {
      terminal.process.kill()
    }
  }

  /**
   * Release a terminal (cleanup)
   */
  const releaseTerminal = (terminalId: string): void => {
    const terminal = terminals.get(terminalId)
    if (terminal) {
      terminal.process.kill()
      terminals.delete(terminalId)
    }
  }

  return {
    initialize,
    cleanup,
    readTextFile,
    writeTextFile,
    createTerminal,
    getTerminalOutput,
    waitForExit,
    killTerminal,
    releaseTerminal,
    isEnabled: () => config.enabled,
  }
}

/** Sandbox handler type */
export type SandboxHandler = ReturnType<typeof createSandboxHandler>
