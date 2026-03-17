import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { createPeerStore, TRUST_LEVEL } from '../peers.ts'
import type { AgentCard } from '../a2a.schemas.ts'
import { signAgentCard } from '../a2a.utils.ts'

// ── Helpers ───────────────────────────────────────────────────────────────────

const generateKeyPair = () =>
  crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])

let tmpDir: string

beforeAll(async () => {
  tmpDir = await Bun.$`mktemp -d`.text()
  tmpDir = tmpDir.trim()
})

afterAll(async () => {
  await Bun.$`rm -rf ${tmpDir}`.nothrow()
})

const testCard: AgentCard = {
  name: 'Peer Agent',
  url: 'https://peer.example.com',
  version: '1.0.0',
}

// ── CRUD Operations ──────────────────────────────────────────────────────────

describe('Peer Store CRUD', () => {
  test('addPeer creates entry with tofu trust level', async () => {
    const store = createPeerStore(join(tmpDir, 'crud-add.json'))
    const keyPair = await generateKeyPair()
    const peer = await store.addPeer(testCard, keyPair.publicKey)

    expect(peer.cardUrl).toBe('https://peer.example.com')
    expect(peer.name).toBe('Peer Agent')
    expect(peer.trustLevel).toBe(TRUST_LEVEL.tofu)
    expect(peer.firstSeen).toBeDefined()
    expect(peer.lastSeen).toBeDefined()
    expect(peer.publicKey).toBeDefined()
  })

  test('getPeer retrieves stored peer', async () => {
    const store = createPeerStore(join(tmpDir, 'crud-get.json'))
    const keyPair = await generateKeyPair()
    await store.addPeer(testCard, keyPair.publicKey)

    const peer = await store.getPeer('https://peer.example.com')
    expect(peer).toBeDefined()
    expect(peer!.name).toBe('Peer Agent')
  })

  test('getPeer returns undefined for unknown peer', async () => {
    const store = createPeerStore(join(tmpDir, 'crud-get-unknown.json'))
    const peer = await store.getPeer('https://nonexistent.example.com')
    expect(peer).toBeUndefined()
  })

  test('updateTrust changes trust level', async () => {
    const store = createPeerStore(join(tmpDir, 'crud-update.json'))
    const keyPair = await generateKeyPair()
    await store.addPeer(testCard, keyPair.publicKey)

    const updated = await store.updateTrust('https://peer.example.com', TRUST_LEVEL.verified)
    expect(updated.trustLevel).toBe(TRUST_LEVEL.verified)

    // Verify persisted
    const retrieved = await store.getPeer('https://peer.example.com')
    expect(retrieved!.trustLevel).toBe(TRUST_LEVEL.verified)
  })

  test('updateTrust throws for unknown peer', async () => {
    const store = createPeerStore(join(tmpDir, 'crud-update-unknown.json'))
    await expect(store.updateTrust('https://ghost.example.com', TRUST_LEVEL.verified)).rejects.toThrow('Peer not found')
  })

  test('removePeer deletes entry', async () => {
    const store = createPeerStore(join(tmpDir, 'crud-remove.json'))
    const keyPair = await generateKeyPair()
    await store.addPeer(testCard, keyPair.publicKey)

    const removed = await store.removePeer('https://peer.example.com')
    expect(removed).toBe(true)

    const peer = await store.getPeer('https://peer.example.com')
    expect(peer).toBeUndefined()
  })

  test('removePeer returns false for unknown peer', async () => {
    const store = createPeerStore(join(tmpDir, 'crud-remove-unknown.json'))
    const removed = await store.removePeer('https://ghost.example.com')
    expect(removed).toBe(false)
  })

  test('listPeers returns all stored peers', async () => {
    const store = createPeerStore(join(tmpDir, 'crud-list.json'))
    const keyPair1 = await generateKeyPair()
    const keyPair2 = await generateKeyPair()

    await store.addPeer(testCard, keyPair1.publicKey)
    await store.addPeer({ ...testCard, name: 'Second', url: 'https://second.example.com' }, keyPair2.publicKey)

    const peers = await store.listPeers()
    expect(peers).toHaveLength(2)
  })
})

// ── Persistence ──────────────────────────────────────────────────────────────

describe('Peer Store Persistence', () => {
  test('data survives across store instances', async () => {
    const path = join(tmpDir, 'persist.json')
    const keyPair = await generateKeyPair()

    const store1 = createPeerStore(path)
    await store1.addPeer(testCard, keyPair.publicKey)

    // New store instance reads from same file
    const store2 = createPeerStore(path)
    const peer = await store2.getPeer('https://peer.example.com')
    expect(peer).toBeDefined()
    expect(peer!.name).toBe('Peer Agent')
  })

  test('empty store returns no peers from nonexistent file', async () => {
    const store = createPeerStore(join(tmpDir, 'nonexistent.json'))
    const peers = await store.listPeers()
    expect(peers).toHaveLength(0)
  })
})

// ── TOFU Verification ────────────────────────────────────────────────────────

describe('Peer Verification', () => {
  test('unknown peer returns unknown_peer', async () => {
    const store = createPeerStore(join(tmpDir, 'verify-unknown.json'))
    const keyPair = await generateKeyPair()
    const result = await store.verifyPeer(testCard, keyPair.publicKey)
    expect(result.trusted).toBe(false)
    expect(result.reason).toBe('unknown_peer')
  })

  test('revoked peer returns peer_revoked', async () => {
    const store = createPeerStore(join(tmpDir, 'verify-revoked.json'))
    const keyPair = await generateKeyPair()
    await store.addPeer(testCard, keyPair.publicKey)
    await store.updateTrust('https://peer.example.com', TRUST_LEVEL.revoked)

    const result = await store.verifyPeer(testCard, keyPair.publicKey)
    expect(result.trusted).toBe(false)
    expect(result.reason).toBe('peer_revoked')
  })

  test('unsigned card returns unsigned_card', async () => {
    const store = createPeerStore(join(tmpDir, 'verify-unsigned.json'))
    const keyPair = await generateKeyPair()
    await store.addPeer(testCard, keyPair.publicKey)

    // Card without signature
    const result = await store.verifyPeer(testCard, keyPair.publicKey)
    expect(result.trusted).toBe(false)
    expect(result.reason).toBe('unsigned_card')
  })

  test('valid signature with matching key returns verified', async () => {
    const store = createPeerStore(join(tmpDir, 'verify-valid.json'))
    const keyPair = await generateKeyPair()
    await store.addPeer(testCard, keyPair.publicKey)

    const signedCard = await signAgentCard(testCard, keyPair.privateKey)
    const result = await store.verifyPeer(signedCard, keyPair.publicKey)
    expect(result.trusted).toBe(true)
    expect(result.reason).toBe('verified')
    expect(result.peer).toBeDefined()
  })

  test('different key returns key_changed', async () => {
    const store = createPeerStore(join(tmpDir, 'verify-key-changed.json'))
    const originalKeyPair = await generateKeyPair()
    const newKeyPair = await generateKeyPair()
    await store.addPeer(testCard, originalKeyPair.publicKey)

    // Sign with new key
    const signedCard = await signAgentCard(testCard, newKeyPair.privateKey)
    const result = await store.verifyPeer(signedCard, newKeyPair.publicKey)
    expect(result.trusted).toBe(false)
    expect(result.reason).toBe('key_changed')
  })

  test('invalid signature returns signature_invalid', async () => {
    const store = createPeerStore(join(tmpDir, 'verify-bad-sig.json'))
    const keyPair = await generateKeyPair()
    const otherKeyPair = await generateKeyPair()
    await store.addPeer(testCard, keyPair.publicKey)

    // Sign with different key than stored, but present stored key for verify
    const signedCard = await signAgentCard(testCard, otherKeyPair.privateKey)
    const result = await store.verifyPeer(signedCard, keyPair.publicKey)
    expect(result.trusted).toBe(false)
    expect(result.reason).toBe('signature_invalid')
  })

  test('verification updates lastSeen timestamp', async () => {
    const store = createPeerStore(join(tmpDir, 'verify-timestamp.json'))
    const keyPair = await generateKeyPair()
    const peer = await store.addPeer(testCard, keyPair.publicKey)
    const originalLastSeen = peer.lastSeen

    // Small delay to ensure timestamp differs
    await Bun.sleep(10)

    const signedCard = await signAgentCard(testCard, keyPair.privateKey)
    const result = await store.verifyPeer(signedCard, keyPair.publicKey)
    expect(result.trusted).toBe(true)
    expect(result.peer!.lastSeen).not.toBe(originalLastSeen)
  })
})

// ── Trust Levels ──────────────────────────────────────────────────────────────

describe('Trust Levels', () => {
  test('TRUST_LEVEL has all expected values', () => {
    expect(TRUST_LEVEL.untrusted).toBe('untrusted')
    expect(TRUST_LEVEL.tofu).toBe('tofu')
    expect(TRUST_LEVEL.verified).toBe('verified')
    expect(TRUST_LEVEL.revoked).toBe('revoked')
  })
})
