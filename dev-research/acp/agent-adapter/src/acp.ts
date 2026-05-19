#!/usr/bin/env bun

/**
 * ACP (Agent Client Protocol) entry point for Plaited nodes.
 *
 * @remarks
 * Provides a debug/admin viewport into any Plaited node running on
 * the current box. An admin SSHs into the box via their editor
 * (Zed, VS Code Remote), then runs `plaited acp --node <name>`
 * to ACP into any node — observing all BP events, A2A traffic,
 * and interacting with the node.
 *
 * ACP is a control UI transport — like WebSocket for browsers,
 * ACP is for editors. Both bridge to the same AgentNode interface.
 *
 * @internal
 */

import { Readable, Writable } from 'node:stream'
import { AgentSideConnection, ndJsonStream } from '@agentclientprotocol/sdk'
import { createAcpAdapter } from './agent/acp-adapter.ts'
import type { AgentNode } from './agent/agent.types.ts'

// ============================================================================
// Node Resolution
// ============================================================================

/**
 * Resolves a running node by name.
 *
 * @remarks
 * Enterprise boxes run multiple nodes, each exposing an AgentNode via
 * a unix socket at `/tmp/plaited-<name>.sock`. For single-node development,
 * the adapter creates the loop directly.
 */
const connectToNode = async (name: string): Promise<AgentNode> => {
  // Option A: Unix socket (nodes expose AgentNode via unix socket)
  const socketPath = `/tmp/plaited-${name}.sock`
  if (await Bun.file(socketPath).exists()) {
    // TODO: Implement unix socket client when node socket server is built.
    // For now, nodes on the same box will use direct import.
    throw new Error(`Unix socket connection not yet implemented: ${socketPath}`)
  }

  // Option B: Direct import (single-node development)
  throw new Error(
    `Node "${name}" not found. Ensure the node is running ` +
      `(expected unix socket at ${socketPath}) or start it first.`,
  )
}

// ============================================================================
// CLI
// ============================================================================

const nodeName = process.argv.find((_, i, a) => a[i - 1] === '--node') ?? 'default'

const adapter = createAcpAdapter({
  resolveNode: () => connectToNode(nodeName),
})

const stream = ndJsonStream(
  Writable.toWeb(process.stdout) as unknown as WritableStream<Uint8Array>,
  Readable.toWeb(process.stdin) as unknown as ReadableStream<Uint8Array>,
)

const conn = new AgentSideConnection(adapter, stream)
await conn.closed
