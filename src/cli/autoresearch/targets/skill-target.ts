import { mkdir } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import type { TrialResult } from '../../eval/eval.schemas.ts'
import type {
  AutoresearchBudget,
  AutoresearchTargetHandler,
  AutoresearchTargetRef,
  CandidateProposal,
} from '../autoresearch.types.ts'

const summarizeFailures = (results: TrialResult[]): string[] =>
  results.flatMap((result) => {
    const failedTrials = result.trials.filter((trial) => trial.pass === false)
    if (failedTrials.length === 0) {
      return []
    }

    return [
      `Prompt '${result.id}' failed ${failedTrials.length}/${result.trials.length} trial(s) for target '${result.id}'.`,
    ]
  })

const buildCandidateArtifactPath = (outputDir: string, candidateId: string): string =>
  join(outputDir, 'candidates', candidateId, 'manifest.json')

const noOpProposal = async ({
  budget,
  observations,
  outputDir,
  target,
}: {
  budget: AutoresearchBudget
  observations: string[]
  outputDir: string
  target: AutoresearchTargetRef
}): Promise<CandidateProposal[]> => {
  if (observations.length === 0 || (budget.maxCandidates ?? 0) < 1) {
    return []
  }

  const candidateId = `${target.kind}-${target.id}-candidate-01`
  const artifactPath = buildCandidateArtifactPath(outputDir, candidateId)
  await mkdir(dirname(artifactPath), { recursive: true })
  await Bun.write(
    artifactPath,
    JSON.stringify(
      {
        candidateId,
        kind: target.kind,
        targetId: target.id,
        status: 'proposal-needed',
        summary: observations[0],
      },
      null,
      2,
    ),
  )

  return [
    {
      id: candidateId,
      summary: `Prepared placeholder ${target.kind} candidate for ${target.id}`,
      artifactPath,
    },
  ]
}

export const skillTargetHandler: AutoresearchTargetHandler = {
  kind: 'skill',
  collectObservations: async ({ baselineResults, evidencePaths }) => {
    const observations = summarizeFailures(baselineResults)
    return [...observations, ...evidencePaths.map((path) => `Additional evidence attached: ${basename(path)}`)]
  },
  proposeCandidates: async ({ budget, observations, outputDir, target }) =>
    noOpProposal({ budget, observations, outputDir, target }),
  validateCandidate: async ({ candidate }) => {
    const exists = await Bun.file(candidate.artifactPath).exists()
    return {
      pass: exists,
      reasoning: exists ? 'Candidate manifest exists and can be reviewed.' : 'Candidate artifact is missing.',
    }
  },
  applyCandidate: async ({ candidate, mode }) => {
    if (mode === 'candidate-only') {
      return
    }

    await mkdir(dirname(candidate.artifactPath), { recursive: true })
    await Bun.write(
      candidate.artifactPath,
      JSON.stringify(
        {
          activated: true,
          activatedAt: Date.now(),
        },
        null,
        2,
      ),
    )
  },
}
