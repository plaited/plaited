import type { Module } from '../../agent.ts'
import { NODE_DISCOVERY_MODULE_SIGNAL_KEYS } from '../node-discovery-module/node-discovery-module.constants.ts'
import type { NodeDiscoveryState } from '../node-discovery-module/node-discovery-module.schemas.ts'
import { PERMISSION_AUDIT_MODULE_SIGNAL_KEYS } from '../permission-audit-module/permission-audit-module.constants.ts'
import type { PermissionAuditRecord } from '../permission-audit-module/permission-audit-module.schemas.ts'
import {
  IDENTITY_TRUST_MODULE_EVENTS,
  IDENTITY_TRUST_MODULE_SIGNAL_KEYS,
} from './identity-trust-module.constants.ts'
import {
  type IdentityTrustState,
  IdentityTrustStateSchema,
  type PeerTrustRecord,
  PeerTrustRecordSchema,
  VerifyPeerDetailSchema,
} from './identity-trust-module.schemas.ts'
import type { CreateIdentityTrustModuleOptions } from './identity-trust-module.types.ts'

const unique = (values: string[]): string[] => [...new Set(values)].sort()

/**
 * Creates the bounded identity and trust module.
 *
 * @public
 */
export const createIdentityTrustModule =
  ({
    stateSignalKey = IDENTITY_TRUST_MODULE_SIGNAL_KEYS.state,
    discoverySignalKey = NODE_DISCOVERY_MODULE_SIGNAL_KEYS.state,
    permissionAuditSignalKey = PERMISSION_AUDIT_MODULE_SIGNAL_KEYS.ledger,
    localIdentityId = 'identity:local',
    trustServiceProfile = 'local_store',
    maxPeers = 20,
  }: CreateIdentityTrustModuleOptions = {}): Module =>
  ({ signals, trigger }) => {
    const stateSignal =
      signals.get(stateSignalKey) ??
      signals.set({
        key: stateSignalKey,
        schema: IdentityTrustStateSchema,
        value: {
          localIdentityId,
          trustServiceProfile,
          auditBoundaries: [],
          peers: [],
        },
        readOnly: false,
      })

    const publish = (next: IdentityTrustState) => {
      const parsed = IdentityTrustStateSchema.parse(next)
      const current = (stateSignal.get() ?? null) as IdentityTrustState | null
      if (current && JSON.stringify(current) === JSON.stringify(parsed)) return
      stateSignal.set?.(parsed)
      trigger({
        type: IDENTITY_TRUST_MODULE_EVENTS.identity_trust_module_updated,
        detail: {
          localIdentityId: parsed.localIdentityId,
          peerCount: parsed.peers.length,
          discoveryNodeId: parsed.discoveryNodeId ?? null,
        },
      })
    }

    const rebuild = () => {
      const current = (stateSignal.get() ?? {
        localIdentityId,
        trustServiceProfile,
        auditBoundaries: [],
        peers: [],
      }) as IdentityTrustState
      const discovery = (signals.get(discoverySignalKey)?.get() ?? null) as NodeDiscoveryState | null
      const ledger = (signals.get(permissionAuditSignalKey)?.get() ?? []) as PermissionAuditRecord[]
      publish({
        ...current,
        discoveryNodeId: discovery?.nodeId ?? current.discoveryNodeId,
        auditBoundaries: unique(ledger.map((record) => record.boundary)),
      })
    }

    signals.get(discoverySignalKey)?.listen(() => rebuild(), true)
    signals.get(permissionAuditSignalKey)?.listen(() => rebuild(), true)
    rebuild()

    return {
      handlers: {
        [IDENTITY_TRUST_MODULE_EVENTS.identity_trust_module_verify_peer](detail) {
          const parsed = VerifyPeerDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as IdentityTrustState | null
          if (!current) return

          const peers = current.peers.filter((peer) => peer.peerId !== parsed.data.peerId)
          const nextPeer = PeerTrustRecordSchema.parse({
            peerId: parsed.data.peerId,
            locator: parsed.data.locator,
            verificationMode: parsed.data.verificationMode,
            trustLevel: parsed.data.success ? 'trusted' : 'restricted',
            claims: parsed.data.claims,
            verifiedAt: Date.now(),
          })

          publish({
            ...current,
            peers: [...peers, nextPeer].slice(-maxPeers) as PeerTrustRecord[],
          })
        },
      },
    }
  }
