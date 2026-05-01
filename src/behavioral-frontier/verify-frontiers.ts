import { BEHAVIORAL_FRONTIER_VERIFY_STATUSES } from './behavioral-frontier.constants.ts'
import {
  type DeadlockFinding,
  type ExploreFrontiersArgs,
  type ExploreFrontiersResult,
  exploreFrontiers,
} from './explore-frontiers.ts'

export type VerifyFrontiersResult = {
  status:
    | typeof BEHAVIORAL_FRONTIER_VERIFY_STATUSES.verified
    | typeof BEHAVIORAL_FRONTIER_VERIFY_STATUSES.failed
    | typeof BEHAVIORAL_FRONTIER_VERIFY_STATUSES.truncated
  findings: DeadlockFinding[]
  report: ExploreFrontiersResult['report']
}

export const verifyFrontiers = (args: ExploreFrontiersArgs): VerifyFrontiersResult => {
  const { findings, report } = exploreFrontiers(args)

  if (findings.length > 0) {
    return {
      status: BEHAVIORAL_FRONTIER_VERIFY_STATUSES.failed,
      findings,
      report,
    }
  }

  if (report.truncated) {
    return {
      status: BEHAVIORAL_FRONTIER_VERIFY_STATUSES.truncated,
      findings,
      report,
    }
  }

  return {
    status: BEHAVIORAL_FRONTIER_VERIFY_STATUSES.verified,
    findings,
    report,
  }
}
