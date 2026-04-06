import type { Module } from '../../agent.ts'
import { PLAN_MODULE_SIGNAL_KEYS } from '../plan-module/plan-module.constants.ts'
import type { PlanState } from '../plan-module/plan-module.schemas.ts'
import { VERIFICATION_MODULE_SIGNAL_KEYS } from '../verification-module/verification-module.constants.ts'
import type { VerificationReport } from '../verification-module/verification-module.schemas.ts'
import { FANOUT_MODULE_EVENTS, FANOUT_MODULE_SIGNAL_KEYS } from './fanout-module.constants.ts'
import {
  FanoutAttemptSchema,
  FanoutRecommendationSchema,
  type FanoutState,
  FanoutStateSchema,
  SelectFanoutWinnerDetailSchema,
  StartFanoutDetailSchema,
  UpdateFanoutAttemptDetailSchema,
} from './fanout-module.schemas.ts'
import type { CreateFanoutModuleOptions } from './fanout-module.types.ts'

const buildRecommendation = ({
  plan,
  verification,
}: {
  plan: PlanState | null
  verification: VerificationReport | null
}) => {
  if (!verification || (verification.status !== 'failed' && verification.status !== 'blocked')) {
    return undefined
  }

  return FanoutRecommendationSchema.parse({
    recommendedCount: verification.findings.length >= 2 ? 3 : 2,
    reason: plan ? `Verification stalled plan '${plan.goal}'.` : 'Verification failed without an active plan.',
  })
}

/**
 * Creates the bounded fanout module.
 *
 * @public
 */
export const createFanoutModule =
  ({
    stateSignalKey = FANOUT_MODULE_SIGNAL_KEYS.state,
    planSignalKey = PLAN_MODULE_SIGNAL_KEYS.plan,
    verificationSignalKey = VERIFICATION_MODULE_SIGNAL_KEYS.report,
    maxAttempts = 4,
    attemptWorkspacePrefix = '.fanout',
  }: CreateFanoutModuleOptions = {}): Module =>
  ({ signals, trigger }) => {
    const stateSignal =
      signals.get(stateSignalKey) ??
      signals.set({
        key: stateSignalKey,
        schema: FanoutStateSchema,
        value: {
          attempts: [],
          winner: null,
        },
        readOnly: false,
      })

    const publish = (next: FanoutState) => {
      const parsed = FanoutStateSchema.parse(next)
      const current = (stateSignal.get() ?? null) as FanoutState | null
      if (current && JSON.stringify(current) === JSON.stringify(parsed)) return
      stateSignal.set?.(parsed)
      trigger({
        type: FANOUT_MODULE_EVENTS.fanout_module_updated,
        detail: {
          attemptCount: parsed.attempts.length,
          winner: parsed.winner?.attemptId ?? null,
          strategy: parsed.strategy ?? null,
        },
      })
    }

    const rebuildRecommendation = () => {
      const current = (stateSignal.get() ?? { attempts: [], winner: null }) as FanoutState
      const plan = (signals.get(planSignalKey)?.get() ?? null) as PlanState | null
      const verification = (signals.get(verificationSignalKey)?.get() ?? null) as VerificationReport | null
      publish({
        ...current,
        goal: current.goal ?? plan?.goal,
        recommendation: buildRecommendation({ plan, verification }),
      })
    }

    signals.get(planSignalKey)?.listen(() => rebuildRecommendation(), true)
    signals.get(verificationSignalKey)?.listen(() => rebuildRecommendation(), true)
    rebuildRecommendation()

    return {
      handlers: {
        [FANOUT_MODULE_EVENTS.fanout_module_start](detail) {
          const parsed = StartFanoutDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? { attempts: [], winner: null }) as FanoutState
          const count = Math.min(parsed.data.count, maxAttempts)
          const attempts = Array.from({ length: count }, (_, index) =>
            FanoutAttemptSchema.parse({
              id: `attempt-${index + 1}`,
              label: `Attempt ${index + 1}`,
              workspace: `${attemptWorkspacePrefix}/attempt-${index + 1}`,
              statusArtifactPath: `${attemptWorkspacePrefix}/attempt-${index + 1}/status.json`,
              status: 'pending',
            }),
          )
          publish({
            ...current,
            goal: parsed.data.goal,
            strategy: parsed.data.strategy,
            attempts,
            winner: null,
          })
        },
        [FANOUT_MODULE_EVENTS.fanout_module_attempt_update](detail) {
          const parsed = UpdateFanoutAttemptDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as FanoutState | null
          if (!current) return
          publish({
            ...current,
            attempts: current.attempts.map((attempt) =>
              attempt.id === parsed.data.attemptId
                ? FanoutAttemptSchema.parse({
                    ...attempt,
                    status: parsed.data.status,
                    diffSummary: parsed.data.diffSummary ?? attempt.diffSummary,
                    validationSummary: parsed.data.validationSummary ?? attempt.validationSummary,
                  })
                : attempt,
            ),
          })
        },
        [FANOUT_MODULE_EVENTS.fanout_module_select_winner](detail) {
          const parsed = SelectFanoutWinnerDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as FanoutState | null
          if (!current) return
          if (!current.attempts.some((attempt) => attempt.id === parsed.data.attemptId)) return

          publish({
            ...current,
            attempts: current.attempts.map((attempt) => {
              if (attempt.id === parsed.data.attemptId) {
                return FanoutAttemptSchema.parse({
                  ...attempt,
                  status: parsed.data.disposition === 'merge' ? 'merged' : 'promoted',
                })
              }

              if (parsed.data.disposition === 'merge') return attempt

              return FanoutAttemptSchema.parse({
                ...attempt,
                status: 'discarded',
              })
            }),
            winner: {
              attemptId: parsed.data.attemptId,
              disposition: parsed.data.disposition,
              rationale: parsed.data.rationale,
              selectedAt: Date.now(),
            },
          })
        },
      },
    }
  }
