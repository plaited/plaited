import type { Module } from '../../agent.ts'
import { THREE_AXIS_MODULE_SIGNAL_KEYS } from '../three-axis-module/three-axis-module.constants.ts'
import type { ThreeAxisState } from '../three-axis-module/three-axis-module.schemas.ts'
import {
  PERMISSION_AUDIT_MODULE_EVENTS,
  PERMISSION_AUDIT_MODULE_SIGNAL_KEYS,
} from './permission-audit-module.constants.ts'
import {
  PermissionAuditLedgerSchema,
  type PermissionAuditRecord,
  PermissionAuditRecordSchema,
} from './permission-audit-module.schemas.ts'
import type { CreatePermissionAuditModuleOptions } from './permission-audit-module.types.ts'

/**
 * Creates the bounded permission audit module.
 *
 * @public
 */
export const createPermissionAuditModule =
  ({
    ledgerSignalKey = PERMISSION_AUDIT_MODULE_SIGNAL_KEYS.ledger,
    threeAxisSignalKey = THREE_AXIS_MODULE_SIGNAL_KEYS.state,
    maxEntries = 50,
  }: CreatePermissionAuditModuleOptions = {}): Module =>
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
        type: PERMISSION_AUDIT_MODULE_EVENTS.permission_audit_module_updated,
        detail: {
          recordCount: next.length,
        },
      })
    }, true)

    return {}
  }
