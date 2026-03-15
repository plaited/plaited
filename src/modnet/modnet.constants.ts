import { keyMirror } from '../utils.ts'

/**
 * Node roles in the modnet topology.
 *
 * @remarks
 * Each node in the modnet is an A2A agent with a role declared in its
 * Agent Card metadata. The role determines the node's responsibilities
 * and the governance rules applied to it.
 *
 * - `pm` — Project Manager node: orchestrates work, manages sub-agents
 * - `worker` — Worker node: executes tasks within a project sandbox
 * - `registry` — Registry node: maintains module directory and peer index
 * - `observer` — Observer node: collects snapshots, monitors health
 *
 * @public
 */
export const NODE_ROLE = keyMirror('pm', 'worker', 'registry', 'observer')

/**
 * Agent Card metadata keys for modnet-specific extensions.
 *
 * @remarks
 * These keys are used in the `metadata` field of an Agent Card to
 * declare modnet-specific properties. The `modnet:` prefix prevents
 * collision with application-level metadata.
 *
 * @public
 */
export const MODNET_METADATA = {
  /** Node role in the modnet topology (value from NODE_ROLE) */
  role: 'modnet:role',
  /** SHA-256 hash of the node's constitution (MAC rules) */
  constitutionHash: 'modnet:constitutionHash',
  /** MSS (Module Sharing Standard) content type */
  mssContentType: 'modnet:mss:contentType',
  /** MSS boundary marker */
  mssBoundary: 'modnet:mss:boundary',
  /** Protocol version this node implements */
  protocolVersion: 'modnet:protocolVersion',
} as const
