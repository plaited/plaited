/**
 * Plaited-specific ACP type definitions.
 *
 * @remarks
 * This module contains types specific to the Plaited ACP client implementation.
 * For SDK types (ToolCall, ContentBlock, SessionNotification, etc.), import
 * directly from `@agentclientprotocol/sdk`.
 *
 * For runtime validation of JSON-RPC messages, import Zod schemas from
 * `./acp.schemas.ts`.
 *
 * For protocol constants, import from `./acp.constants.ts`.
 */

import type { SessionId } from '@agentclientprotocol/sdk'

// ============================================================================
// Sandbox Configuration Types
// ============================================================================

/**
 * Network restrictions for sandbox execution.
 *
 * @remarks
 * Uses allow-only pattern - all network access is blocked by default.
 * Supports wildcard domains like `*.github.com`.
 */
export type SandboxNetworkConfig = {
  /** Permitted host domains (supports wildcards) */
  allowedDomains?: string[]
  /** Blacklisted domains (takes precedence over allowed) */
  deniedDomains?: string[]
  /** Accessible Unix sockets (macOS only) */
  allowUnixSockets?: string[]
  /** Permission for localhost port binding */
  allowLocalBinding?: boolean
}

/**
 * Filesystem restrictions for sandbox execution.
 *
 * @remarks
 * Read access uses deny-only pattern (default allows all reads).
 * Write access uses allow-only pattern (default blocks all writes).
 * Supports glob patterns on macOS, literal paths on Linux.
 */
export type SandboxFilesystemConfig = {
  /** Paths to deny read access (default: allows all) */
  denyRead?: string[]
  /** Paths to allow write access (default: denies all) */
  allowWrite?: string[]
  /** Paths to deny write access within allowed paths */
  denyWrite?: string[]
}

/**
 * Configuration for Anthropic's sandbox-runtime.
 *
 * @remarks
 * Wraps file and terminal operations with OS-level restrictions.
 * Requires `@anthropic-ai/sandbox-runtime` package.
 */
export type SandboxConfig = {
  /** Enable sandboxing for client operations */
  enabled: boolean
  /** Network access restrictions */
  network?: SandboxNetworkConfig
  /** Filesystem access restrictions */
  filesystem?: SandboxFilesystemConfig
}

// ============================================================================
// Session Types
// ============================================================================

/**
 * Session object returned from session creation.
 * Contains the session ID for subsequent operations.
 */
export type Session = {
  id: SessionId
  _meta?: { [key: string]: unknown } | null
}
