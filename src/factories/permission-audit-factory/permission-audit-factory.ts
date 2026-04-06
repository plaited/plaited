import type { Factory } from '../../agent.ts'
import { THREE_AXIS_FACTORY_SIGNAL_KEYS } from '../three-axis-factory/three-axis-factory.constants.ts'
import type { ThreeAxisState } from '../three-axis-factory/three-axis-factory.schemas.ts'
import {
  PERMISSION_AUDIT_FACTORY_EVENTS,
  PERMISSION_AUDIT_FACTORY_SIGNAL_KEYS,
} from './permission-audit-factory.constants.ts'
import {
  PermissionAuditLedgerSchema,
  type PermissionAuditRecord,
  PermissionAuditRecordSchema,
} from './permission-audit-factory.schemas.ts'
import type { CreatePermissionAuditFactoryOptions } from './permission-audit-factory.types.ts'

/**
 * Creates the bounded permission audit factory.
 *
 * @public
 */
export const createPermissionAuditFactory =
  ({
    ledgerSignalKey = PERMISSION_AUDIT_FACTORY_SIGNAL_KEYS.ledger,
    threeAxisSignalKey = THREE_AXIS_FACTORY_SIGNAL_KEYS.state,
    maxEntries = 50,
  }: CreatePermissionAuditFactoryOptions = {}): Factory =>
  ({ signals, trigger }) => {
    const ledgerSignal =
      signals.get(ledgerSignalKey) ??
      signals.set({
        key: ledgerSignalKey,
        schema: PermissionAuditLedgerSchema,
        value: [],
        readOnly: false,
      })

    let lastSignature = ''

    signals.get(threeAxisSignalKey)?.listen(() => {
      const state = (signals.get(threeAxisSignalKey)?.get() ?? { decisions: [] }) as ThreeAxisState
      const signature = state.decisions
        .map((decision) => `${decision.capabilityId}:${decision.autonomyMode}:${decision.authorityScope}`)
        .join('|')
      if (!signature || signature === lastSignature) return
      lastSignature = signature

      const current = (ledgerSignal.get() ?? []) as PermissionAuditRecord[]
      const next = [
        ...current,
        ...state.decisions.map((decision) =>
          PermissionAuditRecordSchema.parse({
            capabilityId: decision.capabilityId,
            decision: decision.autonomyMode,
            boundary: decision.authorityScope,
            timestamp: Date.now(),
          }),
        ),
      ].slice(-maxEntries)

      ledgerSignal.set?.(next)
      trigger({
        type: PERMISSION_AUDIT_FACTORY_EVENTS.permission_audit_factory_updated,
        detail: {
          recordCount: next.length,
        },
      })
    }, true)

    return {}
  }
