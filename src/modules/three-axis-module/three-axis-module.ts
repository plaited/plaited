import type { Module } from '../../agent.ts'
import { TOOL_REGISTRY_MODULE_SIGNAL_KEYS } from '../tool-registry-module/tool-registry-module.constants.ts'
import type { CapabilityRecord } from '../tool-registry-module/tool-registry-module.schemas.ts'
import { VERIFICATION_MODULE_SIGNAL_KEYS } from '../verification-module/verification-module.constants.ts'
import type { VerificationReport } from '../verification-module/verification-module.schemas.ts'
import { THREE_AXIS_MODULE_EVENTS, THREE_AXIS_MODULE_SIGNAL_KEYS } from './three-axis-module.constants.ts'
import {
  type CapabilityDecision,
  CapabilityDecisionSchema,
  ThreeAxisStateSchema,
} from './three-axis-module.schemas.ts'
import type { CreateThreeAxisModuleOptions } from './three-axis-module.types.ts'

const classifyDecision = ({
  capability,
  verification,
}: {
  capability: CapabilityRecord
  verification: VerificationReport | null
}): CapabilityDecision =>
  CapabilityDecisionSchema.parse({
    capabilityId: capability.id,
    authorityScope: capability.authorityHints.join(',') || 'unspecified',
    autonomyMode:
      capability.authorityHints.some((hint) => hint.includes('delete') || hint.includes('exec')) ||
      verification?.status === 'failed'
        ? 'confirm_first'
        : capability.capabilityClass === 'module'
          ? 'owner_only'
          : 'autonomous',
    verificationRequired:
      capability.capabilityClass !== 'built-in' ||
      capability.authorityHints.some((hint) => hint.includes('write') || hint.includes('exec')),
  })

/**
 * Creates the cross-cutting three-axis policy module.
 *
 * @public
 */
export const createThreeAxisModule =
  ({
    stateSignalKey = THREE_AXIS_MODULE_SIGNAL_KEYS.state,
    toolRegistrySignalKey = TOOL_REGISTRY_MODULE_SIGNAL_KEYS.registry,
    verificationSignalKey = VERIFICATION_MODULE_SIGNAL_KEYS.report,
  }: CreateThreeAxisModuleOptions = {}): Module =>
  ({ signals, trigger }) => {
    const stateSignal =
      signals.get(stateSignalKey) ??
      signals.set({
        key: stateSignalKey,
        schema: ThreeAxisStateSchema,
        value: {
          decisions: [],
        },
        readOnly: false,
      })

    const rebuild = () => {
      const capabilities = (signals.get(toolRegistrySignalKey)?.get() ?? []) as CapabilityRecord[]
      const verification = (signals.get(verificationSignalKey)?.get() ?? null) as VerificationReport | null
      const decisions = capabilities.map((capability) => classifyDecision({ capability, verification }))
      stateSignal.set?.({
        decisions,
      })
      trigger({
        type: THREE_AXIS_MODULE_EVENTS.three_axis_module_updated,
        detail: {
          decisionCount: decisions.length,
        },
      })
    }

    signals.get(toolRegistrySignalKey)?.listen(() => rebuild(), true)
    signals.get(verificationSignalKey)?.listen(() => rebuild(), true)

    return {
      handlers: {
        [THREE_AXIS_MODULE_EVENTS.three_axis_module_evaluate]() {
          rebuild()
        },
      },
    }
  }
