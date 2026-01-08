/**
 * Headless ACP client for programmatic agent interaction.
 *
 * @remarks
 * This client enables automated evaluation of ACP-compatible agents like
 * Claude Code, Droid, Gemini CLI, and others. It provides:
 *
 * - **Subprocess management**: Spawn and control agent processes
 * - **Session handling**: Create and manage conversation sessions
 * - **Streaming prompts**: AsyncGenerator for real-time updates
 * - **Sync prompts**: Simple request/response for basic evals
 * - **Auto-permissions**: Automatically approves all permissions for headless use
 *
 * Designed for testing and evaluation, not for user-facing applications.
 */

import type {
  AgentCapabilities,
  ClientCapabilities,
  ClientInfo,
  ContentBlock,
  CreateSessionParams,
  InitializeParams,
  InitializeResult,
  PromptParams,
  PromptResult,
  ReadTextFileParams,
  RequestPermissionParams,
  RequestPermissionResult,
  SandboxConfig,
  Session,
  SessionCancelParams,
  SessionUpdateParams,
  TerminalCreateParams,
  TerminalOutputParams,
  WriteTextFileParams,
} from './acp.types.ts'
import { ACP_METHODS, ACP_PROTOCOL_VERSION } from './acp.types.ts'
import { createSandboxHandler, type SandboxHandler } from './acp-sandbox.ts'
import { type ACPTransport, ACPTransportError, createACPTransport } from './acp-transport.ts'

// ============================================================================
// Types
// ============================================================================

/** Configuration for the ACP client */
export type ACPClientConfig = {
  /** Command to spawn agent (e.g., ['claude', 'code'] or ['droid']) */
  command: string[]
  /** Working directory for agent process */
  cwd?: string
  /** Environment variables for agent process */
  env?: Record<string, string>
  /** Client info for initialization */
  clientInfo?: ClientInfo
  /** Client capabilities to advertise */
  capabilities?: ClientCapabilities
  /** Timeout for operations in milliseconds (default: 30000) */
  timeout?: number
  /**
   * Permission handler for agent requests.
   * Default: auto-approve all permissions (headless mode)
   */
  onPermissionRequest?: (params: RequestPermissionParams) => Promise<RequestPermissionResult>
  /**
   * Sandbox configuration for file and terminal operations.
   * Uses @anthropic-ai/sandbox-runtime for OS-level restrictions.
   * When enabled, the client handles fs/terminal requests from the agent.
   */
  sandbox?: SandboxConfig
}

/** Session update emitted during prompt streaming */
export type SessionUpdate = {
  type: 'update'
  params: SessionUpdateParams
}

/** Prompt completion emitted when prompt finishes */
export type PromptComplete = {
  type: 'complete'
  result: PromptResult
}

/** Events emitted during prompt streaming */
export type PromptEvent = SessionUpdate | PromptComplete

/** Error thrown by ACP client operations */
export class ACPClientError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'ACPClientError'
  }
}

// ============================================================================
// Client Implementation
// ============================================================================

/**
 * Creates a headless ACP client for agent evaluation.
 *
 * @param config - Client configuration
 * @returns Client object with lifecycle, session, and prompt methods
 *
 * @remarks
 * The client manages:
 * - Agent subprocess lifecycle (connect/disconnect)
 * - Protocol initialization and capability negotiation
 * - Session creation and management
 * - Prompt streaming with real-time updates
 * - Automatic permission approval for headless evaluation
 *
 * Basic usage:
 * ```typescript
 * const client = createACPClient({
 *   command: ['claude', 'code'],
 *   cwd: '/path/to/project'
 * })
 *
 * await client.connect()
 * const session = await client.createSession()
 * const result = await client.promptSync(session.id, [
 *   { type: 'text', text: 'List all TypeScript files' }
 * ])
 * await client.disconnect()
 * ```
 */
export const createACPClient = (config: ACPClientConfig) => {
  const {
    command,
    cwd,
    env,
    clientInfo = { name: 'plaited-acp-client', version: '1.0.0' },
    capabilities = { fs: { readTextFile: true, writeTextFile: true }, terminal: true },
    timeout = 30000,
    onPermissionRequest,
    sandbox,
  } = config

  let transport: ACPTransport | undefined
  let agentCapabilities: AgentCapabilities | undefined
  let initializeResult: InitializeResult | undefined

  // Create sandbox handler if enabled
  const sandboxHandler: SandboxHandler | undefined = sandbox?.enabled ? createSandboxHandler(sandbox) : undefined

  // Track active prompt sessions for update routing
  const activePrompts = new Map<
    string,
    {
      updates: SessionUpdateParams[]
      resolve: (result: PromptResult) => void
      reject: (error: Error) => void
    }
  >()

  // --------------------------------------------------------------------------
  // Permission Handling
  // --------------------------------------------------------------------------

  /**
   * Default permission handler: auto-approve all requests.
   * For headless evaluation in trusted environments.
   */
  const autoApprovePermission = async (params: RequestPermissionParams): Promise<RequestPermissionResult> => {
    // Select the first option (typically "allow" or "approve")
    const firstOption = params.options[0]
    if (firstOption) {
      return { outcome: 'selected', optionId: firstOption.id }
    }
    // Fallback: cancel if no options
    return { outcome: 'cancelled' }
  }

  const handlePermissionRequest = onPermissionRequest ?? autoApprovePermission

  // --------------------------------------------------------------------------
  // Transport Callbacks
  // --------------------------------------------------------------------------

  const handleNotification = (method: string, params: unknown) => {
    if (method === ACP_METHODS.UPDATE) {
      const updateParams = params as SessionUpdateParams
      const activePrompt = activePrompts.get(updateParams.sessionId)
      if (activePrompt) {
        activePrompt.updates.push(updateParams)
      }
    }
  }

  const handleRequest = async (method: string, params: unknown): Promise<unknown> => {
    if (method === ACP_METHODS.REQUEST_PERMISSION) {
      return handlePermissionRequest(params as RequestPermissionParams)
    }

    // File system: read
    if (method === ACP_METHODS.READ_TEXT_FILE) {
      if (!sandboxHandler) {
        throw new ACPClientError('File system requests require sandbox to be enabled')
      }
      const { path } = params as ReadTextFileParams
      const content = await sandboxHandler.readTextFile(path)
      return { content }
    }

    // File system: write
    if (method === ACP_METHODS.WRITE_TEXT_FILE) {
      if (!sandboxHandler) {
        throw new ACPClientError('File system requests require sandbox to be enabled')
      }
      const { path, content } = params as WriteTextFileParams
      await sandboxHandler.writeTextFile(path, content)
      return {}
    }

    // Terminal: create
    if (method === ACP_METHODS.TERMINAL_CREATE) {
      if (!sandboxHandler) {
        throw new ACPClientError('Terminal requests require sandbox to be enabled')
      }
      const { command, cwd: termCwd, env: termEnv } = params as TerminalCreateParams
      const terminalId = await sandboxHandler.createTerminal(command, { cwd: termCwd, env: termEnv })
      return { terminalId }
    }

    // Terminal: output
    if (method === ACP_METHODS.TERMINAL_OUTPUT) {
      if (!sandboxHandler) {
        throw new ACPClientError('Terminal requests require sandbox to be enabled')
      }
      const { terminalId } = params as TerminalOutputParams
      const { output, exitCode } = sandboxHandler.getTerminalOutput(terminalId)
      return { output, exitCode }
    }

    // Terminal: wait for exit
    if (method === ACP_METHODS.TERMINAL_WAIT_FOR_EXIT) {
      if (!sandboxHandler) {
        throw new ACPClientError('Terminal requests require sandbox to be enabled')
      }
      const { terminalId } = params as TerminalOutputParams
      const exitCode = await sandboxHandler.waitForExit(terminalId)
      return { exitCode }
    }

    // Terminal: kill
    if (method === ACP_METHODS.TERMINAL_KILL) {
      if (!sandboxHandler) {
        throw new ACPClientError('Terminal requests require sandbox to be enabled')
      }
      const { terminalId } = params as TerminalOutputParams
      sandboxHandler.killTerminal(terminalId)
      return {}
    }

    // Terminal: release
    if (method === ACP_METHODS.TERMINAL_RELEASE) {
      if (!sandboxHandler) {
        throw new ACPClientError('Terminal requests require sandbox to be enabled')
      }
      const { terminalId } = params as TerminalOutputParams
      sandboxHandler.releaseTerminal(terminalId)
      return {}
    }

    throw new ACPClientError(`Unknown request method: ${method}`)
  }

  // --------------------------------------------------------------------------
  // Lifecycle Methods
  // --------------------------------------------------------------------------

  /**
   * Connects to the agent by spawning the subprocess and initializing the protocol.
   *
   * @returns Initialize result with agent capabilities
   * @throws {ACPClientError} If already connected or connection fails
   */
  const connect = async (): Promise<InitializeResult> => {
    if (transport?.isConnected()) {
      throw new ACPClientError('Already connected')
    }

    transport = createACPTransport({
      command,
      cwd,
      env,
      timeout,
      onNotification: handleNotification,
      onRequest: handleRequest,
      onError: (error) => {
        console.error('[ACP Client Error]:', error.message)
      },
      onClose: (code) => {
        // Reject all active prompts on unexpected close
        for (const [sessionId, prompt] of activePrompts) {
          prompt.reject(new ACPClientError(`Agent process exited with code ${code}`))
          activePrompts.delete(sessionId)
        }
      },
    })

    await transport.start()

    // Initialize protocol
    const initParams: InitializeParams = {
      protocolVersion: ACP_PROTOCOL_VERSION,
      clientInfo,
      clientCapabilities: capabilities,
    }

    initializeResult = await transport.request<InitializeResult>(ACP_METHODS.INITIALIZE, initParams)

    agentCapabilities = initializeResult.agentCapabilities

    return initializeResult
  }

  /**
   * Disconnects from the agent, closing the subprocess.
   *
   * @param graceful - If true, sends shutdown request first (default: true)
   */
  const disconnect = async (graceful = true): Promise<void> => {
    if (!transport) return

    // Cancel all active prompts
    for (const [sessionId, prompt] of activePrompts) {
      prompt.reject(new ACPClientError('Client disconnected'))
      activePrompts.delete(sessionId)
    }

    // Cleanup sandbox resources
    if (sandboxHandler) {
      await sandboxHandler.cleanup()
    }

    await transport.close(graceful)
    transport = undefined
    agentCapabilities = undefined
    initializeResult = undefined
  }

  // --------------------------------------------------------------------------
  // Session Methods
  // --------------------------------------------------------------------------

  /**
   * Creates a new conversation session.
   *
   * @param params - Optional session parameters
   * @returns The created session
   * @throws {ACPClientError} If not connected
   */
  const createSession = async (params?: CreateSessionParams): Promise<Session> => {
    if (!transport?.isConnected()) {
      throw new ACPClientError('Not connected')
    }

    return transport.request<Session>(ACP_METHODS.CREATE_SESSION, params ?? {})
  }

  // --------------------------------------------------------------------------
  // Prompt Methods
  // --------------------------------------------------------------------------

  /**
   * Sends a prompt and streams updates as they arrive.
   *
   * @param sessionId - The session ID to send the prompt to
   * @param content - Content blocks for the prompt
   * @yields Session updates and final completion
   * @throws {ACPClientError} If not connected
   *
   * @remarks
   * Use this for evaluation scenarios where you need access to
   * intermediate updates (tool calls, plan changes, etc).
   */
  async function* prompt(sessionId: string, content: ContentBlock[]): AsyncGenerator<PromptEvent> {
    if (!transport?.isConnected()) {
      throw new ACPClientError('Not connected')
    }

    const { promise, resolve, reject } = Promise.withResolvers<PromptResult>()

    const promptState = {
      updates: [] as SessionUpdateParams[],
      resolve,
      reject,
    }

    activePrompts.set(sessionId, promptState)

    // Send prompt request
    const promptParams: PromptParams = {
      sessionId,
      prompt: content,
    }

    // Start the prompt request (don't await - we'll poll for updates)
    const promptPromise = transport.request<PromptResult>(ACP_METHODS.PROMPT, promptParams).then(resolve).catch(reject)

    try {
      // Poll for updates until prompt completes
      let lastYieldedIndex = 0

      while (true) {
        // Yield any new updates
        while (lastYieldedIndex < promptState.updates.length) {
          const update = promptState.updates[lastYieldedIndex]
          if (update) {
            yield { type: 'update', params: update }
          }
          lastYieldedIndex++
        }

        // Check if prompt completed
        const raceResult = await Promise.race([
          promise.then((result) => ({ done: true as const, result })),
          new Promise<{ done: false }>((res) => setTimeout(() => res({ done: false }), 50)),
        ])

        if (raceResult.done) {
          // Yield any remaining updates
          while (lastYieldedIndex < promptState.updates.length) {
            const update = promptState.updates[lastYieldedIndex]
            if (update) {
              yield { type: 'update', params: update }
            }
            lastYieldedIndex++
          }

          // Yield completion
          yield {
            type: 'complete',
            result: raceResult.result,
          }
          break
        }
      }

      await promptPromise
    } finally {
      activePrompts.delete(sessionId)
    }
  }

  /**
   * Sends a prompt and waits for the final result.
   *
   * @param sessionId - The session ID to send the prompt to
   * @param content - Content blocks for the prompt
   * @returns The prompt result with all accumulated updates
   * @throws {ACPClientError} If not connected
   *
   * @remarks
   * Use this for simple evaluation scenarios where you only need
   * the final result. All intermediate updates are collected but
   * returned together at the end.
   */
  const promptSync = async (
    sessionId: string,
    content: ContentBlock[],
  ): Promise<{
    result: PromptResult
    updates: SessionUpdateParams[]
  }> => {
    const updates: SessionUpdateParams[] = []
    let result: PromptResult | undefined

    for await (const event of prompt(sessionId, content)) {
      if (event.type === 'update') {
        updates.push(event.params)
      } else if (event.type === 'complete') {
        result = event.result
      }
    }

    if (!result) {
      throw new ACPClientError('Prompt completed without result')
    }

    return { result, updates }
  }

  /**
   * Cancels an ongoing prompt.
   *
   * @param sessionId - The session ID to cancel
   * @throws {ACPClientError} If not connected
   */
  const cancelPrompt = async (sessionId: string): Promise<void> => {
    if (!transport?.isConnected()) {
      throw new ACPClientError('Not connected')
    }

    const cancelParams: SessionCancelParams = { sessionId }
    await transport.notify(ACP_METHODS.CANCEL, cancelParams)
  }

  // --------------------------------------------------------------------------
  // State Methods
  // --------------------------------------------------------------------------

  /**
   * Gets the agent capabilities negotiated during initialization.
   *
   * @returns Agent capabilities or undefined if not connected
   */
  const getCapabilities = (): AgentCapabilities | undefined => {
    return agentCapabilities
  }

  /**
   * Gets the full initialization result.
   *
   * @returns Initialize result or undefined if not connected
   */
  const getInitializeResult = (): InitializeResult | undefined => {
    return initializeResult
  }

  /**
   * Checks if the client is connected to an agent.
   */
  const isConnected = (): boolean => {
    return transport?.isConnected() ?? false
  }

  return {
    // Lifecycle
    connect,
    disconnect,

    // Sessions
    createSession,

    // Prompts
    prompt,
    promptSync,
    cancelPrompt,

    // State
    getCapabilities,
    getInitializeResult,
    isConnected,
  }
}

/** Client instance type */
export type ACPClient = ReturnType<typeof createACPClient>

// Re-export transport error for convenience
export { ACPTransportError }
