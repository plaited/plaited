import { exploreFrontiers } from './explore-frontiers.ts'

type ExploreFrontiersArgs = Parameters<typeof exploreFrontiers>[0]
type ExploreFrontiersResult = ReturnType<typeof exploreFrontiers>

type VerificationStatus = 'verified' | 'failed' | 'truncated'

type VerifyFrontiersResult = {
  status: VerificationStatus
  report: ExploreFrontiersResult['report']
  findings: ExploreFrontiersResult['findings']
}

/**
 * @internal
 * Thin verification layer on top of replay-safe frontier exploration.
 *
 * Status semantics:
 * - `failed`: one or more findings were discovered
 * - `truncated`: no findings, but exploration was depth-truncated
 * - `verified`: no findings and exploration completed without truncation
 */
export const verifyFrontiers = (args: ExploreFrontiersArgs): VerifyFrontiersResult => {
  const { report, findings } = exploreFrontiers(args)

  if (findings.length > 0) {
    return { status: 'failed', report, findings }
  }
  if (report.truncated) {
    return { status: 'truncated', report, findings }
  }
  return { status: 'verified', report, findings }
}
