import type { Factory } from '../../agent.ts'
import { TOOL_REGISTRY_FACTORY_SIGNAL_KEYS } from '../tool-registry-factory/tool-registry-factory.constants.ts'
import type { CapabilityRecord } from '../tool-registry-factory/tool-registry-factory.schemas.ts'
import { VERIFICATION_FACTORY_SIGNAL_KEYS } from '../verification-factory/verification-factory.constants.ts'
import type { VerificationReport } from '../verification-factory/verification-factory.schemas.ts'
import { THREE_AXIS_FACTORY_EVENTS, THREE_AXIS_FACTORY_SIGNAL_KEYS } from './three-axis-factory.constants.ts'
import {
  type CapabilityDecision,
  CapabilityDecisionSchema,
  ThreeAxisStateSchema,
} from './three-axis-factory.schemas.ts'
import type { CreateThreeAxisFactoryOptions } from './three-axis-factory.types.ts'

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
 * Creates the cross-cutting three-axis policy factory.
 *
 * @public
 */
export const createThreeAxisFactory =
  ({
    stateSignalKey = THREE_AXIS_FACTORY_SIGNAL_KEYS.state,
    toolRegistrySignalKey = TOOL_REGISTRY_FACTORY_SIGNAL_KEYS.registry,
    verificationSignalKey = VERIFICATION_FACTORY_SIGNAL_KEYS.report,
  }: CreateThreeAxisFactoryOptions = {}): Factory =>
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
        type: THREE_AXIS_FACTORY_EVENTS.three_axis_factory_updated,
        detail: {
          decisionCount: decisions.length,
        },
      })
    }

    signals.get(toolRegistrySignalKey)?.listen(() => rebuild(), true)
    signals.get(verificationSignalKey)?.listen(() => rebuild(), true)

    return {
      handlers: {
        [THREE_AXIS_FACTORY_EVENTS.three_axis_factory_evaluate]() {
          rebuild()
        },
      },
    }
  }
