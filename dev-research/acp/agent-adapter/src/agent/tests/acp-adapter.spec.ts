import { describe, expect, test } from 'bun:test'
import type { AgentSideConnection, SessionNotification } from '@agentclientprotocol/sdk'
import { PROTOCOL_VERSION } from '@agentclientprotocol/sdk'

import type { DefaultHandlers } from '../../behavioral/behavioral.types.ts'
import { createAcpAdapter } from '../acp-adapter.ts'
import { AGENT_EVENTS, RISK_TAG } from '../agent.constants.ts'
import type { AgentNode } from '../agent.types.ts'

// ============================================================================
// Mock Helpers
// ============================================================================

/** Creates a mock AgentNode that records triggers and allows manual event dispatch. */
const createMockNode = () => {
  const triggers: Array<{ type: string; detail?: unknown }> = []
  const subscribers: DefaultHandlers[] = []
  let destroyed = false

  const node: AgentNode = {
    trigger: (event) => {
      triggers.push(event)
    },
    subscribe: (handlers) => {
      subscribers.push(handlers)
      return () => {
        const idx = subscribers.indexOf(handlers)
        if (idx >= 0) subscribers.splice(idx, 1)
      }
    },
    snapshot: () => () => {},
    destroy: () => {
      destroyed = true
    },
  }

  /** Dispatch an event to all subscribers. */
  const dispatch = (type: string, detail?: unknown) => {
    for (const handlers of subscribers) {
      handlers[type]?.(detail)
    }
  }

  return { node, triggers, subscribers, dispatch, isDestroyed: () => destroyed }
}

/** Standard newSession params with required mcpServers. */
const newSessionParams = (cwd: string) => ({ cwd, mcpServers: [] })

/** Creates a mock AgentSideConnection that records updates, permissions, and ext notifications. */
const createMockConnection = () => {
  const updates: SessionNotification[] = []
  const extNotifications: Array<{ method: string; params: Record<string, unknown> }> = []
  const permissionRequests: Array<{ resolve: (response: unknown) => void; params: unknown }> = []
  const abortController = new AbortController()

  const conn = {
    sessionUpdate: async (params: SessionNotification) => {
      updates.push(params)
    },
    requestPermission: async (params: unknown) =>
      new Promise((resolve) => {
        permissionRequests.push({ resolve, params })
      }),
    extNotification: async (method: string, params: Record<string, unknown>) => {
      extNotifications.push({ method, params })
    },
    signal: abortController.signal,
  } as unknown as AgentSideConnection

  return { conn, updates, extNotifications, permissionRequests, abortController }
}

// ============================================================================
// Tests
// ============================================================================

describe('createAcpAdapter', () => {
  test('initialize returns capabilities with A2A observation support', async () => {
    const { node } = createMockNode()
    const { conn } = createMockConnection()

    const adapterFactory = createAcpAdapter({ resolveNode: () => node })
    const agent = adapterFactory(conn)

    const response = await agent.initialize({
      protocolVersion: PROTOCOL_VERSION,
    })

    expect(response.protocolVersion).toBe(PROTOCOL_VERSION)
    expect(response.agentCapabilities?.loadSession).toBe(false)
    expect(response.agentCapabilities?.promptCapabilities?.embeddedContext).toBe(true)
    expect(response.agentInfo?.name).toBe('plaited')
  })

  test('newSession resolves node and triggers client_connected', async () => {
    const { node, triggers } = createMockNode()
    const { conn } = createMockConnection()

    const adapterFactory = createAcpAdapter({ resolveNode: () => node })
    const agent = adapterFactory(conn)
    await agent.initialize({ protocolVersion: PROTOCOL_VERSION })

    const response = await agent.newSession(newSessionParams('/workspace'))

    expect(response.sessionId).toBeString()
    expect(response.sessionId.length).toBe(32) // 16 bytes hex-encoded

    // Should have triggered client_connected
    const connected = triggers.find((t) => t.type === 'client_connected')
    expect(connected).toBeDefined()
    expect(connected?.detail).toMatchObject({
      sessionId: response.sessionId,
      source: 'acp',
      isReconnect: false,
    })
  })

  test('prompt triggers task and streams thinking_delta as agent_thought_chunk', async () => {
    const { node, dispatch } = createMockNode()
    const { conn, updates } = createMockConnection()

    const adapterFactory = createAcpAdapter({ resolveNode: () => node })
    const agent = adapterFactory(conn)
    await agent.initialize({ protocolVersion: PROTOCOL_VERSION })
    const { sessionId } = await agent.newSession(newSessionParams('/workspace'))

    // Start prompt, then dispatch events from the "agent" side
    const promptPromise = agent.prompt({
      sessionId,
      prompt: [{ type: 'text', text: 'Hello agent' }],
    })

    // Simulate agent events
    dispatch(AGENT_EVENTS.thinking_delta, { content: 'Let me think...' })
    dispatch(AGENT_EVENTS.text_delta, { content: 'Here is my response.' })
    dispatch(AGENT_EVENTS.message, { content: 'Here is my response.' })

    const result = await promptPromise

    expect(result.stopReason).toBe('end_turn')

    // Verify thinking delta was sent as agent_thought_chunk
    const thoughtUpdate = updates.find((u) => u.update.sessionUpdate === 'agent_thought_chunk')
    expect(thoughtUpdate).toBeDefined()
    expect(thoughtUpdate?.update).toMatchObject({
      sessionUpdate: 'agent_thought_chunk',
      content: { type: 'text', text: 'Let me think...' },
    })

    // Verify text delta was sent as agent_message_chunk
    const messageUpdate = updates.find((u) => u.update.sessionUpdate === 'agent_message_chunk')
    expect(messageUpdate).toBeDefined()
    expect(messageUpdate?.update).toMatchObject({
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'Here is my response.' },
    })
  })

  test('prompt streams execute as tool_call in_progress', async () => {
    const { node, dispatch } = createMockNode()
    const { conn, updates } = createMockConnection()

    const adapterFactory = createAcpAdapter({ resolveNode: () => node })
    const agent = adapterFactory(conn)
    await agent.initialize({ protocolVersion: PROTOCOL_VERSION })
    const { sessionId } = await agent.newSession(newSessionParams('/workspace'))

    const promptPromise = agent.prompt({
      sessionId,
      prompt: [{ type: 'text', text: 'Read a file' }],
    })

    dispatch(AGENT_EVENTS.execute, {
      toolCall: { id: 'tc-1', name: 'read_file', arguments: { path: '/foo.ts' } },
      tags: [RISK_TAG.workspace],
    })

    dispatch(AGENT_EVENTS.tool_result, {
      result: { tool_call_id: 'tc-1', output: 'file contents' },
    })

    dispatch(AGENT_EVENTS.message, { content: 'Done reading.' })

    const result = await promptPromise
    expect(result.stopReason).toBe('end_turn')

    // Verify tool_call was sent
    const toolCallUpdate = updates.find((u) => u.update.sessionUpdate === 'tool_call')
    expect(toolCallUpdate).toBeDefined()
    expect(toolCallUpdate?.update).toMatchObject({
      sessionUpdate: 'tool_call',
      toolCallId: 'tc-1',
      title: 'read_file',
      kind: 'read',
      status: 'in_progress',
    })

    // Verify tool_call_update with completed status
    const toolResultUpdate = updates.find(
      (u) => u.update.sessionUpdate === 'tool_call_update' && 'status' in u.update && u.update.status === 'completed',
    )
    expect(toolResultUpdate).toBeDefined()
  })

  test('cancel aborts pending prompt', async () => {
    const { node } = createMockNode()
    const { conn } = createMockConnection()

    const adapterFactory = createAcpAdapter({ resolveNode: () => node })
    const agent = adapterFactory(conn)
    await agent.initialize({ protocolVersion: PROTOCOL_VERSION })
    const { sessionId } = await agent.newSession(newSessionParams('/workspace'))

    const promptPromise = agent.prompt({
      sessionId,
      prompt: [{ type: 'text', text: 'Do something long' }],
    })

    // Cancel after a tick
    await new Promise((r) => setTimeout(r, 10))
    await agent.cancel({ sessionId })

    const result = await promptPromise
    expect(result.stopReason).toBe('cancelled')
  })

  test('gate_rejected sends tool_call_update with error content', async () => {
    const { node, dispatch } = createMockNode()
    const { conn, updates } = createMockConnection()

    const adapterFactory = createAcpAdapter({ resolveNode: () => node })
    const agent = adapterFactory(conn)
    await agent.initialize({ protocolVersion: PROTOCOL_VERSION })
    const { sessionId } = await agent.newSession(newSessionParams('/workspace'))

    const promptPromise = agent.prompt({
      sessionId,
      prompt: [{ type: 'text', text: 'Try dangerous thing' }],
    })

    dispatch(AGENT_EVENTS.gate_rejected, {
      toolCall: { id: 'tc-2', name: 'bash' },
      decision: { reason: 'rm -rf is blocked by constitution' },
    })

    dispatch(AGENT_EVENTS.message, { content: 'Operation was blocked.' })

    const result = await promptPromise
    expect(result.stopReason).toBe('end_turn')

    const rejectedUpdate = updates.find(
      (u) =>
        u.update.sessionUpdate === 'tool_call_update' &&
        'rawOutput' in u.update &&
        u.update.rawOutput !== undefined &&
        typeof u.update.rawOutput === 'object' &&
        u.update.rawOutput !== null &&
        'error' in u.update.rawOutput,
    )
    expect(rejectedUpdate).toBeDefined()
  })

  test('A2A observation sends extNotification for inbound/outbound traffic', async () => {
    const { node, subscribers } = createMockNode()
    const { conn, extNotifications } = createMockConnection()

    const adapterFactory = createAcpAdapter({ resolveNode: () => node })
    const agent = adapterFactory(conn)
    await agent.initialize({ protocolVersion: PROTOCOL_VERSION })
    await agent.newSession(newSessionParams('/workspace'))

    // The A2A handlers are registered via node.subscribe during newSession
    // Find the subscriber that has a2a_inbound handler
    const a2aSubscriber = subscribers.find((h) => h.a2a_inbound)
    expect(a2aSubscriber).toBeDefined()

    // Simulate A2A inbound event
    if (a2aSubscriber) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- guarded by find predicate above
      a2aSubscriber.a2a_inbound!({ from: 'worker-1', task: 'status-check' })
      a2aSubscriber.a2a_outbound!({ to: 'registry', task: 'discover-services' })
    }

    // Wait for async ext notification
    await new Promise((r) => setTimeout(r, 10))

    expect(extNotifications).toContainEqual({
      method: 'plaited/a2a_inbound',
      params: { from: 'worker-1', task: 'status-check' },
    })
    expect(extNotifications).toContainEqual({
      method: 'plaited/a2a_outbound',
      params: { to: 'registry', task: 'discover-services' },
    })
  })

  test('multi-session creates independent connections to same node', async () => {
    const { node, triggers } = createMockNode()
    const { conn } = createMockConnection()

    const adapterFactory = createAcpAdapter({ resolveNode: () => node })
    const agent = adapterFactory(conn)
    await agent.initialize({ protocolVersion: PROTOCOL_VERSION })

    const session1 = await agent.newSession(newSessionParams('/workspace-1'))
    const session2 = await agent.newSession(newSessionParams('/workspace-2'))

    expect(session1.sessionId).not.toBe(session2.sessionId)

    // Both sessions should have triggered client_connected
    const connectedEvents = triggers.filter((t) => t.type === 'client_connected')
    expect(connectedEvents).toHaveLength(2)
  })

  test('connection close triggers client_disconnected and cleanup', async () => {
    const { node, triggers } = createMockNode()
    const { conn, abortController } = createMockConnection()

    const adapterFactory = createAcpAdapter({ resolveNode: () => node })
    const agent = adapterFactory(conn)
    await agent.initialize({ protocolVersion: PROTOCOL_VERSION })
    const { sessionId } = await agent.newSession(newSessionParams('/workspace'))

    // Simulate connection close
    abortController.abort()

    // Wait for the abort listener to fire
    await new Promise((r) => setTimeout(r, 10))

    const disconnected = triggers.find((t) => t.type === 'client_disconnected')
    expect(disconnected).toBeDefined()
    expect(disconnected?.detail).toMatchObject({
      sessionId,
      code: 1000,
    })
  })

  test('authenticate returns empty (SSH provides admin credential)', async () => {
    const { node } = createMockNode()
    const { conn } = createMockConnection()

    const adapterFactory = createAcpAdapter({ resolveNode: () => node })
    const agent = adapterFactory(conn)

    const result = await agent.authenticate({ methodId: 'ssh' })
    expect(result).toEqual({})
  })

  test('node resolution receives cwd from newSession params', async () => {
    let resolvedName: string | undefined
    const { node } = createMockNode()
    const { conn } = createMockConnection()

    const adapterFactory = createAcpAdapter({
      resolveNode: (name) => {
        resolvedName = name
        return node
      },
    })
    const agent = adapterFactory(conn)
    await agent.initialize({ protocolVersion: PROTOCOL_VERSION })
    await agent.newSession(newSessionParams('/my/project'))

    expect(resolvedName).toBe('/my/project')
  })

  test('plan_saved sends plan session update', async () => {
    const { node, dispatch } = createMockNode()
    const { conn, updates } = createMockConnection()

    const adapterFactory = createAcpAdapter({ resolveNode: () => node })
    const agent = adapterFactory(conn)
    await agent.initialize({ protocolVersion: PROTOCOL_VERSION })
    const { sessionId } = await agent.newSession(newSessionParams('/workspace'))

    const promptPromise = agent.prompt({
      sessionId,
      prompt: [{ type: 'text', text: 'Plan something' }],
    })

    dispatch(AGENT_EVENTS.plan_saved, {
      plan: {
        goal: 'Refactor module',
        steps: [
          { id: 'step-1', intent: 'Read current code' },
          { id: 'step-2', intent: 'Write new version' },
        ],
      },
    })

    dispatch(AGENT_EVENTS.message, { content: 'Plan created.' })

    await promptPromise

    const planUpdate = updates.find((u) => u.update.sessionUpdate === 'plan')
    expect(planUpdate).toBeDefined()
    expect(planUpdate?.update).toMatchObject({
      sessionUpdate: 'plan',
      entries: [
        { content: 'Read current code', priority: 'medium', status: 'pending' },
        { content: 'Write new version', priority: 'medium', status: 'pending' },
      ],
    })
  })

  test('prompt extracts text from multiple content blocks', async () => {
    const { node, triggers, dispatch } = createMockNode()
    const { conn } = createMockConnection()

    const adapterFactory = createAcpAdapter({ resolveNode: () => node })
    const agent = adapterFactory(conn)
    await agent.initialize({ protocolVersion: PROTOCOL_VERSION })
    const { sessionId } = await agent.newSession(newSessionParams('/workspace'))

    const promptPromise = agent.prompt({
      sessionId,
      prompt: [
        { type: 'text', text: 'First part.' },
        { type: 'text', text: 'Second part.' },
      ],
    })

    dispatch(AGENT_EVENTS.message, { content: 'Got it.' })

    await promptPromise

    const taskTrigger = triggers.find((t) => t.type === AGENT_EVENTS.task)
    expect(taskTrigger?.detail).toMatchObject({
      prompt: 'First part.\nSecond part.',
    })
  })
})
