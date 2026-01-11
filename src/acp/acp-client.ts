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
  CancelNotification,
  ClientCapabilities,
  ContentBlock,
  Implementation,
  InitializeRequest,
  InitializeResponse,
  NewSessionRequest,
  PromptRequest,
  PromptResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionNotification,
} from '@agentclientprotocol/sdk'
import { version } from '../../package.json' with { type: 'json' }
import { ACP_METHODS, ACP_PROTOCOL_VERSION, DEFAULT_ACP_CLIENT_NAME } from './acp.constants.ts'
import { RequestPermissionRequestSchema, SessionNotificationSchema } from './acp.schemas.ts'
import type { Session } from './acp.types.ts'
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
  clientInfo?: Implementation
  /** Client capabilities to advertise */
  capabilities?: ClientCapabilities
  /** Timeout for operations in milliseconds (default: 30000) */
  timeout?: number
  /**
   * Permission handler for agent requests.
   * Default: auto-approve all permissions (headless mode)
   */
  onPermissionRequest?: (params: RequestPermissionRequest) => Promise<RequestPermissionResponse>
}

/** Session update emitted during prompt streaming */
export type SessionUpdate = {
  type: 'update'
  params: SessionNotification
}

/** Prompt completion emitted when prompt finishes */
export type PromptComplete = {
  type: 'complete'
  result: PromptResponse
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
 * @param config - Client configuration including command, cwd, and sandbox options
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
 * See module-level documentation in `src/acp.ts` for usage guidance.
 * See client tests for usage patterns.
 */
export const createACPClient = (config: ACPClientConfig) => {
  const {
    command,
    cwd,
    env,
    clientInfo = { name: DEFAULT_ACP_CLIENT_NAME, version },
    capabilities = {},
    timeout = 30000,
    onPermissionRequest,
  } = config

  let transport: ACPTransport | undefined
  let agentCapabilities: AgentCapabilities | undefined
  let initializeResult: InitializeResponse | undefined

  // Track active prompt sessions for update routing
  const activePrompts = new Map<
    string,
    {
      updates: SessionNotification[]
      resolve: (result: PromptResponse) => void
      reject: (error: Error) => void
    }
  >()

  // --------------------------------------------------------------------------
  // Permission Handling
  // --------------------------------------------------------------------------

  /**
   * Default permission handler: auto-approve all requests.
   * For headless evaluation in trusted environments.
   *
   * @remarks
   * Validates params with Zod before processing.
   * Prioritizes `allow_always` for faster headless evaluation with fewer
   * permission round-trips. Sandbox restrictions provide the safety net.
   * Cancels if validation fails or no allow option is available.
   */
  const autoApprovePermission = async (params: RequestPermissionRequest): Promise<RequestPermissionResponse> => {
    const result = RequestPermissionRequestSchema.safeParse(params)
    if (!result.success) {
      return { outcome: { outcome: 'cancelled' } }
    }

    const { options } = result.data

    // Priority: allow_always (fewer round-trips) > allow_once
    // Sandbox restrictions are the safety net, not permissions
    const allowAlways = options.find((opt) => opt.kind === 'allow_always')
    if (allowAlways) {
      return { outcome: { outcome: 'selected', optionId: allowAlways.optionId } }
    }

    const allowOnce = options.find((opt) => opt.kind === 'allow_once')
    if (allowOnce) {
      return { outcome: { outcome: 'selected', optionId: allowOnce.optionId } }
    }

    // No allow option available - cancel
    return { outcome: { outcome: 'cancelled' } }
  }

  const handlePermissionRequest = onPermissionRequest ?? autoApprovePermission

  // --------------------------------------------------------------------------
  // Transport Callbacks
  // --------------------------------------------------------------------------

  const handleNotification = (method: string, params: unknown) => {
    if (method === ACP_METHODS.UPDATE) {
      const updateParams = SessionNotificationSchema.parse(params)
      const activePrompt = activePrompts.get(updateParams.sessionId)
      if (activePrompt) {
        activePrompt.updates.push(updateParams)
      }
    }
  }

  const handleRequest = async (method: string, params: unknown): Promise<unknown> => {
    if (method === ACP_METHODS.REQUEST_PERMISSION) {
      return handlePermissionRequest(RequestPermissionRequestSchema.parse(params))
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
  const connect = async (): Promise<InitializeResponse> => {
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
    const initParams: InitializeRequest = {
      protocolVersion: ACP_PROTOCOL_VERSION,
      clientInfo,
      clientCapabilities: capabilities,
    }

    initializeResult = await transport.request<InitializeResponse>(ACP_METHODS.INITIALIZE, initParams)

    agentCapabilities = initializeResult?.agentCapabilities

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
   * @param params - Session parameters (cwd and mcpServers are required by SDK)
   * @returns The created session
   * @throws {ACPClientError} If not connected
   */
  const createSession = async (params: NewSessionRequest): Promise<Session> => {
    if (!transport?.isConnected()) {
      throw new ACPClientError('Not connected')
    }

    const response = await transport.request<{ sessionId: string }>(ACP_METHODS.CREATE_SESSION, params)
    return { id: response.sessionId }
  }

  /**
   * Sets the model for a session.
   *
   * @experimental This is an unstable ACP feature and may change.
   * @param sessionId - The session ID to set the model for
   * @param modelId - The model ID (e.g., 'claude-3-5-haiku-20241022', 'claude-sonnet-4-20250514')
   * @throws {ACPClientError} If not connected
   */
  const setModel = async (sessionId: string, modelId: string): Promise<void> => {
    if (!transport?.isConnected()) {
      throw new ACPClientError('Not connected')
    }

    await transport.request(ACP_METHODS.SET_MODEL, { sessionId, modelId })
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

    const { promise, resolve, reject } = Promise.withResolvers<PromptResponse>()

    const promptState = {
      updates: [] as SessionNotification[],
      resolve,
      reject,
    }

    activePrompts.set(sessionId, promptState)

    // Send prompt request
    const promptParams: PromptRequest = {
      sessionId,
      prompt: content,
    }

    // Start the prompt request (don't await - we'll poll for updates)
    const promptPromise = transport
      .request<PromptResponse>(ACP_METHODS.PROMPT, promptParams)
      .then(resolve)
      .catch(reject)

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
    result: PromptResponse
    updates: SessionNotification[]
  }> => {
    const updates: SessionNotification[] = []
    let result: PromptResponse | undefined

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

    const cancelParams: CancelNotification = { sessionId }
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
  const getInitializeResult = (): InitializeResponse | undefined => {
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
    setModel,

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
