import type { Module } from '../../agent.ts'
import { PLAN_MODULE_SIGNAL_KEYS } from '../plan-module/plan-module.constants.ts'
import type { PlanState } from '../plan-module/plan-module.schemas.ts'
import { SEARCH_MODULE_SIGNAL_KEYS } from '../search-module/search-module.constants.ts'
import type { SearchResults } from '../search-module/search-module.schemas.ts'
import { VERIFICATION_MODULE_EVENTS, VERIFICATION_MODULE_SIGNAL_KEYS } from './verification-module.constants.ts'
import {
  NullableVerificationReportSchema,
  type VerificationFinding,
  VerificationFindingSchema,
  type VerificationReport,
  VerificationReportSchema,
} from './verification-module.schemas.ts'
import type { CreateVerificationModuleOptions } from './verification-module.types.ts'

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
 * Creates the deterministic verification module.
 *
 * @public
 */
export const createVerificationModule =
  ({
    reportSignalKey = VERIFICATION_MODULE_SIGNAL_KEYS.report,
    planSignalKey = PLAN_MODULE_SIGNAL_KEYS.plan,
    searchResultsSignalKey = SEARCH_MODULE_SIGNAL_KEYS.results,
  }: CreateVerificationModuleOptions = {}): Module =>
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
        type: VERIFICATION_MODULE_EVENTS.verification_module_updated,
        detail: {
          status: report.status,
          findingCount: report.findings.length,
        },
      })
    }

    return {
      handlers: {
        [VERIFICATION_MODULE_EVENTS.verification_module_run]() {
          runVerification()
        },
      },
    }
  }
