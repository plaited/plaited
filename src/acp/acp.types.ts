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
