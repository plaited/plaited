# Custom Adapters

> Building protocol adapters with useBehavioral

## Overview

Adapters bridge the world agent to external protocols (ACP, A2A, MCP, HTTP, stdio). Each adapter is a behavioral program that:

1. Owns its transport event loop
2. Receives agent events via signal subscription
3. Emits events to the agent via outbound signal
4. Exposes `disconnect` as a public event for lifecycle management

## The disconnect Pattern

Every adapter **must** expose `disconnect` as a public event. This is the contract that enables the orchestrator to coordinate shutdown:

```typescript
const myAdapter = useBehavioral<
  { agentEvent: AgentOutEvent; disconnect: undefined },
  { outbound: Signal<unknown> }
>({
  publicEvents: ['agentEvent', 'disconnect'],  // disconnect is required

  bProgram({ disconnect }) {
    return {
      agentEvent(event) {
        // Handle agent events
      },
      disconnect() {
        // Clean up transport
        transport.close()
        disconnect()  // Signal behavioral program to end
      },
    }
  },
})
```

## Outbound Signal Communication

Adapters communicate with the agent through their `outbound` signal. The orchestrator wires this to the agent's trigger:

```typescript
bProgram({ outbound, disconnect }) {
  // Transport receives external message
  transport.onMessage((msg) => {
    // Convert to agent event and emit via signal
    outbound.set({ type: 'generate', detail: { intent: msg.content } })
  })

  return {
    agentEvent(event) {
      // Convert agent event to protocol format and send
      transport.send(convertToProtocol(event))
    },
    disconnect() {
      transport.close()
      disconnect()
    },
  }
}
```

## Adapter Skeleton

Here's a minimal adapter template:

```typescript
import { useBehavioral, useSignal } from 'plaited'
import type { Signal } from 'plaited'
import type { AgentOutEvent } from 'plaited/agent'

/**
 * Adapter event types.
 */
type AdapterEvents = {
  agentEvent: AgentOutEvent
  disconnect: undefined
}

/**
 * Adapter context requirements.
 */
type AdapterContext = {
  outbound: Signal<unknown>
  // Add protocol-specific config here
}

/**
 * Creates a custom adapter.
 */
export const createMyAdapter = (config: { port: number }) => {
  return useBehavioral<AdapterEvents, AdapterContext>({
    publicEvents: ['agentEvent', 'disconnect'],

    bProgram({ outbound, disconnect }) {
      // Initialize transport (HTTP server, stdio, WebSocket, etc.)
      const transport = initializeTransport(config)

      // Transport -> Agent (via outbound signal)
      transport.onMessage((msg) => {
        outbound.set({
          type: 'generate',
          detail: { intent: msg.content },
        })
      })

      return {
        // Agent -> Transport
        agentEvent(event) {
          switch (event.kind) {
            case 'thought':
              transport.send({ type: 'thinking', content: event.content })
              break
            case 'toolCall':
              transport.send({ type: 'tool_use', calls: event.calls })
              break
            case 'toolResult':
              transport.send({ type: 'tool_result', name: event.name, result: event.result })
              break
            case 'response':
              transport.send({ type: 'response', content: event.content })
              break
            case 'error':
              transport.send({ type: 'error', message: event.error.message })
              break
          }
        },

        // Lifecycle
        disconnect() {
          transport.close()
          disconnect()
        },
      }
    },
  })
}
```

## Protocol-Specific Adapters

### ACP Adapter

For Agent Client Protocol (IDE integration):

```typescript
const acpAdapter = createAcpAdapter({
  transport: 'stdio',  // or 'http'
  serverInfo: {
    name: 'world-agent',
    version: '1.0.0',
  },
})
```

### A2A Adapter

For Agent-to-Agent protocol:

```typescript
const a2aAdapter = createA2AAdapter({
  card: {
    name: 'ui-generator',
    description: 'Generates UI templates',
    url: 'https://agent.example.com',
    skills: [{ id: 'generate', name: 'Generate UI' }],
  },
  port: 3001,
})
```

### MCP Adapter

For Model Context Protocol (tool servers):

```typescript
const mcpAdapter = createMcpAdapter({
  servers: [
    { name: 'filesystem', command: 'mcp-fs' },
    { name: 'database', command: 'mcp-db' },
  ],
})
```

## Testing Adapters

```typescript
import { useSignal } from 'plaited'
import { createMyAdapter } from './my-adapter'

test('adapter receives agent events', async () => {
  const outbound = useSignal<unknown>()
  const received: unknown[] = []

  // Mock transport
  const mockTransport = {
    send: (msg: unknown) => received.push(msg),
    close: () => {},
  }

  const trigger = await createMyAdapter({ port: 3000 })({ outbound })

  // Simulate agent event
  trigger({
    type: 'agentEvent',
    detail: { kind: 'thought', content: 'Processing...' },
  })

  expect(received).toContainEqual({ type: 'thinking', content: 'Processing...' })
})
```

## Key Principles

1. **Adapter owns transport** - Adapters manage their event loops, not the agent
2. **Signal isolation** - Agent and adapter only communicate via signals
3. **Consistent lifecycle** - Always expose `disconnect` for clean shutdown
4. **Protocol translation** - Adapt between agent event format and protocol format
