import type { Factory } from '../../agent.ts'
import { PLAN_FACTORY_SIGNAL_KEYS } from '../plan-factory/plan-factory.constants.ts'
import type { PlanState } from '../plan-factory/plan-factory.schemas.ts'
import { SEARCH_FACTORY_SIGNAL_KEYS } from '../search-factory/search-factory.constants.ts'
import type { SearchResults } from '../search-factory/search-factory.schemas.ts'
import { VERIFICATION_FACTORY_EVENTS, VERIFICATION_FACTORY_SIGNAL_KEYS } from './verification-factory.constants.ts'
import {
  NullableVerificationReportSchema,
  type VerificationFinding,
  VerificationFindingSchema,
  type VerificationReport,
  VerificationReportSchema,
} from './verification-factory.schemas.ts'
import type { CreateVerificationFactoryOptions } from './verification-factory.types.ts'

const buildReport = ({
  plan,
  search,
}: {
  plan: PlanState | null
  search: SearchResults | null
}): VerificationReport => {
  const findings: VerificationFinding[] = []

  if (plan) {
    const ids = new Set<string>()
    for (const step of plan.steps) {
      if (ids.has(step.id)) {
        findings.push(
          VerificationFindingSchema.parse({
            code: 'duplicate-step-id',
            message: `Duplicate plan step id '${step.id}'.`,
          }),
        )
      }
      ids.add(step.id)

      if (step.tools.length === 0) {
        findings.push(
          VerificationFindingSchema.parse({
            code: 'missing-tools',
            message: `Plan step '${step.id}' does not declare any tools.`,
          }),
        )
      }

      for (const dependency of step.depends ?? []) {
        if (!plan.steps.some((candidate) => candidate.id === dependency)) {
          findings.push(
            VerificationFindingSchema.parse({
              code: 'missing-dependency',
              message: `Plan step '${step.id}' depends on unknown step '${dependency}'.`,
            }),
          )
        }
      }
    }
  } else {
    findings.push(
      VerificationFindingSchema.parse({
        code: 'missing-plan',
        message: 'No active plan is available for verification.',
      }),
    )
  }

  if (plan && search && search.results.length === 0) {
    findings.push(
      VerificationFindingSchema.parse({
        code: 'empty-search-evidence',
        message: 'Search evidence is empty for the current verification pass.',
      }),
    )
  }

  const status =
    findings.length === 0
      ? 'verified'
      : findings.some((finding) => finding.code === 'missing-plan')
        ? 'blocked'
        : 'failed'

  return VerificationReportSchema.parse({
    status,
    findings,
    checkedAt: Date.now(),
  })
}

/**
 * Creates the deterministic verification factory.
 *
 * @public
 */
export const createVerificationFactory =
  ({
    reportSignalKey = VERIFICATION_FACTORY_SIGNAL_KEYS.report,
    planSignalKey = PLAN_FACTORY_SIGNAL_KEYS.plan,
    searchResultsSignalKey = SEARCH_FACTORY_SIGNAL_KEYS.results,
  }: CreateVerificationFactoryOptions = {}): Factory =>
  ({ signals, trigger }) => {
    const reportSignal =
      signals.get(reportSignalKey) ??
      signals.set({
        key: reportSignalKey,
        schema: NullableVerificationReportSchema,
        value: null,
        readOnly: false,
      })

    const runVerification = () => {
      const plan = (signals.get(planSignalKey)?.get() ?? null) as PlanState | null
      const search = (signals.get(searchResultsSignalKey)?.get() ?? null) as SearchResults | null
      const report = buildReport({ plan, search })
      reportSignal.set?.(report)
      trigger({
        type: VERIFICATION_FACTORY_EVENTS.verification_factory_updated,
        detail: {
          status: report.status,
          findingCount: report.findings.length,
        },
      })
    }

    return {
      handlers: {
        [VERIFICATION_FACTORY_EVENTS.verification_factory_run]() {
          runVerification()
        },
      },
    }
  }
