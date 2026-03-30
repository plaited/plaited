import type { TrialEntry, TrialResult } from './eval.schemas.ts'

const average = (values: number[]): number | undefined => {
  if (values.length === 0) {
    return undefined
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

const round = (value: number | undefined): number | undefined => {
  if (value === undefined) {
    return undefined
  }

  return Number(value.toFixed(3))
}

const getString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

const getRecord = (value: unknown): Record<string, unknown> | undefined => {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : undefined
}

const getMetadataString = (result: TrialResult, keys: string[]): string | undefined => {
  const metadata = getRecord(result.metadata)
  if (!metadata) {
    return undefined
  }

  for (const key of keys) {
    const value = getString(metadata[key])
    if (value) {
      return value
    }
  }

  return undefined
}

const getNativeModelJudge = (entry: TrialEntry): Record<string, unknown> | undefined => {
  const outcome = getRecord(entry.outcome)
  if (!outcome) {
    return undefined
  }

  return getRecord(outcome.nativeModelJudge)
}

const getRetentionLabel = (entry: TrialEntry): string | undefined => {
  const nativeModelJudge = getNativeModelJudge(entry)
  if (nativeModelJudge) {
    return getString(nativeModelJudge.retentionLabel)
  }

  const outcome = getRecord(entry.outcome)
  return outcome ? getString(outcome.retentionLabel) : undefined
}

export type TrialPromptSummary = {
  id: string
  themeId?: string
  taskType?: string
  totalTrials: number
  passedTrials: number
  failedTrials: number
  passRate?: number
  averageScore?: number
  retentionLabels: Record<string, number>
}

export type TrialThemeSummary = {
  themeId: string
  promptCount: number
  totalTrials: number
  passedTrials: number
  failedTrials: number
  passRate?: number
  averageScore?: number
  retentionLabels: Record<string, number>
}

export type TrialRunSummary = {
  promptCount: number
  totalTrials: number
  passedTrials: number
  failedTrials: number
  passRate?: number
  averageScore?: number
  prompts: TrialPromptSummary[]
  themes: TrialThemeSummary[]
}

type TrialThemeAccumulator = TrialThemeSummary & {
  scoreValues: number[]
}

export const summarizeEvalResults = (results: TrialResult[]): TrialRunSummary => {
  const promptSummaries = results
    .map((result): TrialPromptSummary => {
      const scores = result.trials
        .map((trial) => trial.score)
        .filter((score): score is number => typeof score === 'number')

      const passedTrials = result.trials.filter((trial) => trial.pass === true).length
      const retentionLabels = result.trials.reduce<Record<string, number>>((labels, trial) => {
        const label = getRetentionLabel(trial)
        if (!label) {
          return labels
        }

        labels[label] = (labels[label] ?? 0) + 1
        return labels
      }, {})

      return {
        id: result.id,
        themeId: getMetadataString(result, ['themeId', 'theme_id', 'theme']),
        taskType: getMetadataString(result, ['taskType', 'task_type']),
        totalTrials: result.trials.length,
        passedTrials,
        failedTrials: result.trials.length - passedTrials,
        passRate: round(
          result.passRate ?? (result.trials.length > 0 ? passedTrials / result.trials.length : undefined),
        ),
        averageScore: round(average(scores)),
        retentionLabels,
      }
    })
    .sort((left, right) => left.id.localeCompare(right.id))

  const themeMap = new Map<string, TrialThemeAccumulator>()
  for (const result of results) {
    const themeId = getMetadataString(result, ['themeId', 'theme_id', 'theme'])
    if (!themeId) {
      continue
    }

    const existing = themeMap.get(themeId) ?? {
      themeId,
      promptCount: 0,
      totalTrials: 0,
      passedTrials: 0,
      failedTrials: 0,
      retentionLabels: {},
      scoreValues: [],
    }

    existing.promptCount += 1
    existing.totalTrials += result.trials.length
    existing.passedTrials += result.trials.filter((trial) => trial.pass === true).length
    existing.failedTrials = existing.totalTrials - existing.passedTrials

    for (const trial of result.trials) {
      if (typeof trial.score === 'number') {
        existing.scoreValues.push(trial.score)
      }
    }

    for (const trial of result.trials) {
      const label = getRetentionLabel(trial)
      if (!label) {
        continue
      }

      existing.retentionLabels[label] = (existing.retentionLabels[label] ?? 0) + 1
    }

    existing.passRate = round(existing.totalTrials > 0 ? existing.passedTrials / existing.totalTrials : undefined)
    existing.averageScore = round(average(existing.scoreValues))
    themeMap.set(themeId, existing)
  }

  const totalTrials = promptSummaries.reduce((sum, prompt) => sum + prompt.totalTrials, 0)
  const passedTrials = promptSummaries.reduce((sum, prompt) => sum + prompt.passedTrials, 0)
  const scoreValues = results.flatMap((result) =>
    result.trials.map((trial) => trial.score).filter((score): score is number => typeof score === 'number'),
  )

  return {
    promptCount: results.length,
    totalTrials,
    passedTrials,
    failedTrials: totalTrials - passedTrials,
    passRate: round(totalTrials > 0 ? passedTrials / totalTrials : undefined),
    averageScore: round(average(scoreValues)),
    prompts: promptSummaries,
    themes: [...themeMap.values()]
      .map(({ scoreValues: _scoreValues, ...theme }) => theme)
      .sort((left, right) => left.themeId.localeCompare(right.themeId)),
  }
}

const formatLabelCounts = (labels: Record<string, number>): string => {
  const entries = Object.entries(labels).sort(([left], [right]) => left.localeCompare(right))
  if (entries.length === 0) {
    return 'none'
  }

  return entries.map(([label, count]) => `${label}=${count}`).join(', ')
}

const formatNumber = (value: number | undefined): string => {
  if (value === undefined) {
    return 'n/a'
  }

  return value.toFixed(3)
}

export const formatEvalSummary = (summary: TrialRunSummary): string => {
  const lines = [
    '# Eval Summary',
    '',
    '## Overall',
    '',
    `- Prompts: ${summary.promptCount}`,
    `- Trials: ${summary.totalTrials}`,
    `- Validation passed trials: ${summary.passedTrials}`,
    `- Validation failed trials: ${summary.failedTrials}`,
    `- Validation pass rate: ${formatNumber(summary.passRate)}`,
    `- Average score: ${formatNumber(summary.averageScore)}`,
    '',
    '## By Prompt',
    '',
  ]

  for (const prompt of summary.prompts) {
    lines.push(
      `- ${prompt.id}: theme=${prompt.themeId ?? 'n/a'}, task=${prompt.taskType ?? 'n/a'}, validation=${prompt.passedTrials}/${prompt.totalTrials} (${formatNumber(prompt.passRate)}), avgScore=${formatNumber(prompt.averageScore)}, labels=${formatLabelCounts(prompt.retentionLabels)}`,
    )
  }

  if (summary.themes.length > 0) {
    lines.push('', '## By Theme', '')
    for (const theme of summary.themes) {
      lines.push(
        `- ${theme.themeId}: prompts=${theme.promptCount}, validation=${theme.passedTrials}/${theme.totalTrials} (${formatNumber(theme.passRate)}), avgScore=${formatNumber(theme.averageScore)}, labels=${formatLabelCounts(theme.retentionLabels)}`,
      )
    }
  }

  return `${lines.join('\n')}\n`
}
