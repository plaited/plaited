#!/usr/bin/env bun
/**
 * Headless adapter factory CLI entry point.
 *
 * @remarks
 * This module implements a schema-driven adapter that can interact with
 * ANY headless CLI agent. The adapter:
 *
 * 1. Reads a JSON schema defining how to interact with the CLI
 * 2. Spawns the CLI process per schema's command + flags
 * 3. Parses stdout using schema's outputEvents mappings
 * 4. Emits session update notifications
 * 5. Manages session state for multi-turn (stream or iterative mode)
 *
 * @packageDocumentation
 */

import { createInterface } from 'node:readline'
import { parseArgs } from 'node:util'
import { PROTOCOL_VERSION } from '../schemas/constants.ts'
import { type HeadlessAdapterConfig, parseHeadlessConfig } from './headless.schemas.ts'
import { createSessionManager, type SessionManager } from './headless-session-manager.ts'

// ============================================================================
// Types
// ============================================================================

/** JSON-RPC 2.0 request */
type JsonRpcRequest = {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: unknown
}

/** JSON-RPC 2.0 notification */
type JsonRpcNotification = {
  jsonrpc: '2.0'
  method: string
  params?: unknown
}

/** JSON-RPC 2.0 success response */
type JsonRpcSuccessResponse = {
  jsonrpc: '2.0'
  id: string | number
  result: unknown
}

/** JSON-RPC 2.0 error response */
type JsonRpcErrorResponse = {
  jsonrpc: '2.0'
  id: string | number | null
  error: {
    code: number
    message: string
    data?: unknown
  }
}

/** JSON-RPC 2.0 response */
type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse

/** Content block for prompts */
type ContentBlock = { type: 'text'; text: string } | { type: 'image'; source: unknown }

// ============================================================================
// Message Sending
// ============================================================================

/**
 * Sends a JSON-RPC message to stdout.
 */
const sendMessage = (message: JsonRpcResponse | JsonRpcNotification): void => {
  console.log(JSON.stringify(message))
}

/**
 * Sends a session update notification.
 */
const sendSessionUpdate = (sessionId: string, update: unknown): void => {
  sendMessage({
    jsonrpc: '2.0',
    method: 'session/update',
    params: { sessionId, update },
  })
}

// ============================================================================
// Request Handlers
// ============================================================================

/**
 * Creates request handlers for the headless adapter.
 *
 * @param schema - Headless adapter configuration
 * @param sessions - Session manager instance
 */
const createHandlers = (schema: HeadlessAdapterConfig, sessions: SessionManager) => {
  /**
   * Handle initialize request.
   */
  const handleInitialize = async (params: unknown): Promise<unknown> => {
    const { protocolVersion } = params as { protocolVersion: number }

    if (protocolVersion !== PROTOCOL_VERSION) {
      throw new Error(`Unsupported protocol version: ${protocolVersion}`)
    }

    return {
      protocolVersion: PROTOCOL_VERSION,
      agentInfo: {
        name: schema.name,
        version: '1.0.0',
      },
      agentCapabilities: {
        loadSession: !!schema.resume,
        promptCapabilities: {
          image: false,
        },
      },
    }
  }

  /**
   * Handle session/new request.
   */
  const handleSessionNew = async (params: unknown): Promise<unknown> => {
    const { cwd } = params as { cwd: string }
    const session = await sessions.create(cwd)
    return { sessionId: session.id }
  }

  /**
   * Handle session/load request.
   */
  const handleSessionLoad = async (params: unknown): Promise<unknown> => {
    const { sessionId } = params as { sessionId: string }
    const session = sessions.get(sessionId)

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    return { sessionId }
  }

  /**
   * Handle session/prompt request.
   */
  const handleSessionPrompt = async (params: unknown): Promise<unknown> => {
    const { sessionId, prompt } = params as { sessionId: string; prompt: ContentBlock[] }

    // Extract text from content blocks
    const promptText = prompt
      .filter((block): block is ContentBlock & { type: 'text' } => block.type === 'text')
      .map((block) => block.text)
      .join('\n')

    // Execute prompt and stream updates
    const result = await sessions.prompt(sessionId, promptText, (update) => {
      // Map parsed update to session update format
      const sessionUpdate = mapToSessionUpdate(update)
      sendSessionUpdate(sessionId, sessionUpdate)
    })

    return {
      content: [{ type: 'text', text: result.output }],
    }
  }

  /**
   * Handle session/cancel notification.
   */
  const handleSessionCancel = async (params: unknown): Promise<void> => {
    const { sessionId } = params as { sessionId: string }
    sessions.cancel(sessionId)
  }

  return {
    handleInitialize,
    handleSessionNew,
    handleSessionLoad,
    handleSessionPrompt,
    handleSessionCancel,
  }
}

/**
 * Maps a parsed update to session update format.
 */
const mapToSessionUpdate = (update: { type: string; content?: string; title?: string; status?: string }): unknown => {
  switch (update.type) {
    case 'thought':
      return {
        sessionUpdate: 'agent_thought_chunk',
        content: { type: 'text', text: update.content ?? '' },
      }

    case 'message':
      return {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: update.content ?? '' },
      }

    case 'tool_call':
      return {
        sessionUpdate: 'agent_tool_call',
        toolCall: {
          name: update.title ?? 'unknown',
          status: update.status ?? 'pending',
        },
      }

    case 'plan':
      return {
        sessionUpdate: 'agent_plan',
        content: { type: 'text', text: update.content ?? '' },
      }

    default:
      return {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: update.content ?? '' },
      }
  }
}

// ============================================================================
// Main Loop
// ============================================================================

/**
 * Runs the headless adapter main loop.
 *
 * @param schema - Headless adapter configuration
 * @param verbose - Whether to show debug output
 */
const runAdapter = async (schema: HeadlessAdapterConfig, verbose = false): Promise<void> => {
  const sessions = createSessionManager({ schema, verbose })
  const handlers = createHandlers(schema, sessions)

  // Method handlers (requests expect responses)
  const methodHandlers: Record<string, (params: unknown) => Promise<unknown>> = {
    initialize: handlers.handleInitialize,
    'session/new': handlers.handleSessionNew,
    'session/load': handlers.handleSessionLoad,
    'session/prompt': handlers.handleSessionPrompt,
  }

  // Notification handlers (no response expected)
  const notificationHandlers: Record<string, (params: unknown) => Promise<void>> = {
    'session/cancel': handlers.handleSessionCancel,
  }

  /**
   * Process incoming JSON-RPC message.
   */
  const processMessage = async (line: string): Promise<void> => {
    let request: JsonRpcRequest | JsonRpcNotification

    try {
      request = JSON.parse(line)
    } catch {
      sendMessage({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      })
      return
    }

    // Check if it's a notification (no id)
    const isNotification = !('id' in request)

    if (isNotification) {
      const handler = notificationHandlers[request.method]
      if (handler) {
        await handler(request.params)
      }
      // No response for notifications
      return
    }

    // It's a request - send response
    const reqWithId = request as JsonRpcRequest
    const handler = methodHandlers[reqWithId.method]

    if (!handler) {
      sendMessage({
        jsonrpc: '2.0',
        id: reqWithId.id,
        error: { code: -32601, message: `Method not found: ${reqWithId.method}` },
      })
      return
    }

    try {
      const result = await handler(reqWithId.params)
      sendMessage({
        jsonrpc: '2.0',
        id: reqWithId.id,
        result,
      })
    } catch (error) {
      sendMessage({
        jsonrpc: '2.0',
        id: reqWithId.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        },
      })
    }
  }

  // Main loop: read lines from stdin
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  })

  rl.on('line', processMessage)

  // Handle clean shutdown
  process.on('SIGTERM', () => {
    rl.close()
    process.exit(0)
  })

  process.on('SIGINT', () => {
    rl.close()
    process.exit(0)
  })
}

// ============================================================================
// CLI Entry Point
// ============================================================================

/**
 * Headless adapter CLI entry point.
 *
 * @param args - Command line arguments
 */
export const headless = async (args: string[]): Promise<void> => {
  const { values } = parseArgs({
    args,
    options: {
      schema: { type: 'string', short: 's' },
      verbose: { type: 'boolean', short: 'v' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: false,
  })

  if (values.help) {
    console.log(`
Usage: agent-eval-harness headless --schema <path> [--verbose]

Arguments:
  -s, --schema    Path to headless adapter schema (JSON)
  -v, --verbose   Show constructed commands (for debugging)
  -h, --help      Show this help message

Description:
  Schema-driven adapter for ANY headless CLI agent. The adapter reads
  a JSON schema defining how to interact with the CLI and translates between
  protocol and CLI stdio.

Schema Format:
  {
    "version": 1,
    "name": "my-agent",
    "command": ["my-agent-cli"],
    "sessionMode": "stream" | "iterative",
    "prompt": { "flag": "-p" },
    "output": { "flag": "--output-format", "value": "stream-json" },
    "outputEvents": [...],
    "result": { "matchPath": "$.type", "matchValue": "result", "contentPath": "$.content" }
  }

Examples:
  # Run with Claude headless schema
  agent-eval-harness headless --schema ./claude-headless.json

  # Use in capture pipeline
  agent-eval-harness capture prompts.jsonl --schema ./claude-headless.json -o results.jsonl
`)
    return
  }

  if (!values.schema) {
    console.error('Error: --schema is required')
    console.error('Example: agent-eval-harness headless --schema ./my-agent.json')
    process.exit(1)
  }

  // Load and validate schema
  const schemaPath = values.schema
  const schemaFile = Bun.file(schemaPath)

  if (!(await schemaFile.exists())) {
    console.error(`Error: schema file not found: ${schemaPath}`)
    process.exit(1)
  }

  let schema: HeadlessAdapterConfig
  try {
    const rawSchema = await schemaFile.json()
    schema = parseHeadlessConfig(rawSchema)
  } catch (error) {
    console.error(`Error: invalid schema: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }

  // Run the adapter
  await runAdapter(schema, values.verbose ?? false)
}

// Allow direct execution
if (import.meta.main) {
  headless(Bun.argv.slice(2)).catch((error) => {
    console.error('Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
