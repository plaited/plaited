import * as z from 'zod'
import { keyMirror } from '../utils.ts'
import type { AgentCard } from './a2a.schemas.ts'
import { verifyAgentCardSignature } from './a2a.utils.ts'

// ============================================================================
// Trust Level Constants
// ============================================================================

/**
 * Trust levels for known peers.
 *
 * @remarks
 * Progression: `untrusted` → `tofu` → `verified`, or → `revoked`.
 *
 * - `untrusted` — peer discovered but not yet accepted
 * - `tofu` — Trust On First Use, automatically accepted on first encounter
 * - `verified` — explicitly confirmed by the owner
 * - `revoked` — trust withdrawn, reject all communication
 *
 * @public
 */
export const TRUST_LEVEL = keyMirror('untrusted', 'tofu', 'verified', 'revoked')

// ============================================================================
// Known Peer Schema
// ============================================================================

const trustLevelValues = Object.values(TRUST_LEVEL)

/**
 * A known peer entry in the trust store.
 *
 * @remarks
 * Maps to the `known_peers` table from skills/modnet-node/references/access-control.md.
 * Stored as a JSON file, keyed by the peer's Agent Card URL.
 *
 * @public
 */
export const KnownPeerSchema = z.object({
  /** The peer's Agent Card URL — the unique identifier */
  cardUrl: z.string(),
  /** The peer's name (from Agent Card) */
  name: z.string(),
  /** JWK-encoded public key for signature verification */
  publicKey: z.unknown(),
  /** Current trust level */
  trustLevel: z.enum(trustLevelValues),
  /** ISO 8601 timestamp of first encounter */
  firstSeen: z.string(),
  /** ISO 8601 timestamp of last successful verification */
  lastSeen: z.string(),
  /** Agent Card metadata snapshot at last verification */
  metadata: z.record(z.string(), z.unknown()).optional(),
})

/** @public */
export type KnownPeer = z.infer<typeof KnownPeerSchema>

/**
 * The full peers file schema — a record keyed by card URL.
 *
 * @internal
 */
const PeerStoreSchema = z.record(z.string(), KnownPeerSchema)

type PeerStoreData = z.infer<typeof PeerStoreSchema>

// ============================================================================
// Peer Store Module
// ============================================================================

/**
 * Trust level value — one of the values from TRUST_LEVEL constants.
 *
 * @public
 */
export type TrustLevel = (typeof TRUST_LEVEL)[keyof typeof TRUST_LEVEL]

/**
 * Return type of {@link createPeerStore}.
 *
 * @public
 */
export type PeerStore = {
  addPeer: (card: AgentCard, publicKey: CryptoKey, trustLevel?: TrustLevel) => Promise<KnownPeer>
  getPeer: (cardUrl: string) => Promise<KnownPeer | undefined>
  updateTrust: (cardUrl: string, trustLevel: TrustLevel) => Promise<KnownPeer>
  removePeer: (cardUrl: string) => Promise<boolean>
  listPeers: () => Promise<KnownPeer[]>
  verifyPeer: (
    card: AgentCard,
    publicKey: CryptoKey,
  ) => Promise<{
    trusted: boolean
    reason: string
    peer?: KnownPeer
  }>
}

/**
 * Creates a file-backed peer trust store.
 *
 * @remarks
 * Persistence via `Bun.file()`/`Bun.write()` to a JSON file at `path`.
 * Implements TOFU (Trust On First Use) — first encounter is auto-accepted
 * at `tofu` trust level. Subsequent encounters verify the stored public key.
 *
 * The store reads from disk on every operation (no stale in-memory cache).
 * Writes are atomic — full file replacement via `Bun.write()`.
 *
 * @param path - Absolute path to the peers JSON file
 * @returns Peer store operations
 *
 * @public
 */
export const createPeerStore = (path: string): PeerStore => {
  /** Read the peer store from disk, returning empty record if file doesn't exist */
  const read = async (): Promise<PeerStoreData> => {
    const file = Bun.file(path)
    if (!(await file.exists())) return {}
    const raw = await file.json()
    return PeerStoreSchema.parse(raw)
  }

  /** Write the full peer store to disk */
  const write = async (data: PeerStoreData): Promise<void> => {
    await Bun.write(path, JSON.stringify(data, null, 2))
  }

  /** Export a CryptoKey to JWK for storage */
  const exportKey = async (key: CryptoKey): Promise<JsonWebKey> => crypto.subtle.exportKey('jwk', key)

  /** Import a JWK back to CryptoKey for verification */
  const importKey = async (jwk: JsonWebKey): Promise<CryptoKey> =>
    crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify'])

  return {
    addPeer: async (card, publicKey, trustLevel = TRUST_LEVEL.tofu) => {
      const data = await read()
      const now = new Date().toISOString()
      const jwk = await exportKey(publicKey)

      const peer: KnownPeer = {
        cardUrl: card.url,
        name: card.name,
        publicKey: jwk,
        trustLevel,
        firstSeen: now,
        lastSeen: now,
        metadata: card.metadata,
      }

      data[card.url] = peer
      await write(data)
      return peer
    },

    getPeer: async (cardUrl) => {
      const data = await read()
      return data[cardUrl]
    },

    updateTrust: async (cardUrl, trustLevel) => {
      const data = await read()
      const peer = data[cardUrl]
      if (!peer) throw new Error(`Peer not found: ${cardUrl}`)

      peer.trustLevel = trustLevel
      peer.lastSeen = new Date().toISOString()
      data[cardUrl] = peer
      await write(data)
      return peer
    },

    removePeer: async (cardUrl) => {
      const data = await read()
      if (!(cardUrl in data)) return false
      delete data[cardUrl]
      await write(data)
      return true
    },

    listPeers: async () => {
      const data = await read()
      return Object.values(data)
    },

    verifyPeer: async (card, publicKey) => {
      const data = await read()
      const peer = data[card.url]

      // First encounter — TOFU
      if (!peer) {
        return { trusted: false, reason: 'unknown_peer' }
      }

      // Revoked — always reject
      if (peer.trustLevel === TRUST_LEVEL.revoked) {
        return { trusted: false, reason: 'peer_revoked', peer }
      }

      // Verify signature on the card
      if (!card.signature?.signature) {
        return { trusted: false, reason: 'unsigned_card', peer }
      }

      const valid = await verifyAgentCardSignature(card, publicKey)
      if (!valid) {
        return { trusted: false, reason: 'signature_invalid', peer }
      }

      // Compare stored public key with presented key
      const presentedJwk = await exportKey(publicKey)
      const storedKey = await importKey(peer.publicKey as JsonWebKey)
      const storedJwk = await exportKey(storedKey)

      // Key comparison — check the x/y coordinates of the EC key
      if (presentedJwk.x !== storedJwk.x || presentedJwk.y !== storedJwk.y) {
        return { trusted: false, reason: 'key_changed', peer }
      }

      // Update last seen
      peer.lastSeen = new Date().toISOString()
      data[card.url] = peer
      await write(data)

      return { trusted: true, reason: 'verified', peer }
    },
  }
}
