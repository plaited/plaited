import { basename } from 'node:path'
import type { TrialResult } from '../../eval/eval.schemas.ts'
import type { AutoresearchTargetHandler } from '../autoresearch.types.ts'
import { skillTargetHandler } from './skill-target.ts'

const summarizeFactoryObservations = (results: TrialResult[]): string[] =>
  results.flatMap((result) => {
    if ((result.passRate ?? 1) >= 1) {
      return []
    }

    return [
      `Factory target saw incomplete success on '${result.id}' with passRate=${(result.passRate ?? 0).toFixed(2)}.`,
    ]
  })

export const factoryTargetHandler: AutoresearchTargetHandler = {
  kind: 'factory',
  collectObservations: async ({ baselineResults, evidencePaths }) => {
    const observations = summarizeFactoryObservations(baselineResults)
    return [...observations, ...evidencePaths.map((path) => `Factory evidence attached: ${basename(path)}`)]
  },
  proposeCandidates: skillTargetHandler.proposeCandidates,
  validateCandidate: skillTargetHandler.validateCandidate,
  applyCandidate: skillTargetHandler.applyCandidate,
}
