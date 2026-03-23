#!/usr/bin/env bun

import { join } from 'node:path'
import * as z from 'zod'
import type { PromptCase } from '../src/improve.ts'
import { PromptCaseSchema } from '../src/improve.ts'
import { appendJsonlRow, resetJsonlOutput } from './jsonl-output.ts'
import { grade as judgeDerivedPrompt } from './modnet-prompt-derivation-judge.ts'
import { grade as metaVerifyDerivedPrompt } from './modnet-prompt-derivation-meta-verifier.ts'

export const DerivedPromptCandidateSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetScale: z.enum(['S1', 'S2', 'S3']),
  input: z.string(),
  hint: z.string(),
})

export type DerivedPromptCandidate = z.infer<typeof DerivedPromptCandidateSchema>

export const DeterministicCheckSchema = z.object({
  pass: z.boolean(),
  hardFailures: z.array(z.string()),
  softWarnings: z.array(z.string()),
  checks: z.object({
    sourceExists: z.boolean(),
    idIsUnique: z.boolean(),
    inputHasEnoughDetail: z.boolean(),
    hintHasEnoughDetail: z.boolean(),
    sourceIsHigherScale: z.boolean(),
    targetScaleMatchesId: z.boolean(),
    avoidsGenericTemplateLanguage: z.boolean(),
    hasSourceLexicalAnchor: z.boolean(),
  }),
  score: z.number().min(0).max(1),
})

export type DeterministicCheck = z.infer<typeof DeterministicCheckSchema>

export const DerivedPromptEvaluationSchema = z.object({
  candidate: DerivedPromptCandidateSchema,
  sourcePrompt: PromptCaseSchema,
  deterministicCheck: DeterministicCheckSchema,
  judge: z.record(z.string(), z.unknown()).optional(),
  metaVerification: z.record(z.string(), z.unknown()).optional(),
  recommended: z.boolean(),
})

type DerivedPromptEvaluation = z.infer<typeof DerivedPromptEvaluationSchema>

const DEFAULT_SOURCE_CATALOG = join(
  import.meta.dir,
  '..',
  'dev-research',
  'modnet',
  'catalog',
  'modnet-training-prompts.jsonl',
)
const DEFAULT_INPUT = join(import.meta.dir, 'modnet-derived-prompts.json')
const DEFAULT_OUTPUT = join(import.meta.dir, '..', 'tmp', 'modnet-derived-prompt-evals.jsonl')

const GENERIC_TEMPLATE_PATTERNS = [
  'smallest useful single object',
  'grouped object/list view',
  'block-level surface',
  'larger module would be built from',
  'larger module would likely use',
  'derived s1 precursor candidate',
  'derived s2 precursor candidate',
  'derived s3 precursor candidate',
]

const getRequiredConcepts = (prompt: PromptCase): string[] => {
  const judge = prompt.metadata?.judge
  if (!judge || typeof judge !== 'object') {
    return []
  }

  const requiredConcepts = (judge as Record<string, unknown>).requiredConcepts
  return Array.isArray(requiredConcepts)
    ? requiredConcepts.filter((value): value is string => typeof value === 'string')
    : []
}

const getSourceScale = (prompt: PromptCase): number | null => {
  const requiredConcepts = getRequiredConcepts(prompt)
  for (const concept of requiredConcepts) {
    const match = /^scale-S(\d)$/i.exec(concept)
    if (match) {
      return Number(match[1]!)
    }
  }

  return null
}

const normalizeWord = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const buildLexicalAnchorSet = (prompt: PromptCase): Set<string> => {
  const fields = [prompt.input, prompt.hint, prompt.metadata?.patternFamily]
  const tokens = fields
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string => typeof value === 'string')
    .flatMap((value) => normalizeWord(value).split(/\s+/))
    .filter((value) => value.length >= 4)

  return new Set(tokens)
}

export const assessDerivedPromptCandidate = ({
  candidate,
  sourcePrompt,
  seenIds,
}: {
  candidate: DerivedPromptCandidate
  sourcePrompt?: PromptCase
  seenIds: Set<string>
}): DeterministicCheck => {
  const hardFailures: string[] = []
  const softWarnings: string[] = []

  const sourceExists = Boolean(sourcePrompt)
  if (!sourceExists) {
    hardFailures.push(`missing-source:${candidate.sourceId}`)
  }

  const idIsUnique = !seenIds.has(candidate.id)
  if (!idIsUnique) {
    hardFailures.push(`duplicate-id:${candidate.id}`)
  }

  const inputHasEnoughDetail = normalizeWord(candidate.input).split(/\s+/).filter(Boolean).length >= 8
  if (!inputHasEnoughDetail) {
    hardFailures.push('input-too-short')
  }

  const hintHasEnoughDetail = normalizeWord(candidate.hint).split(/\s+/).filter(Boolean).length >= 6
  if (!hintHasEnoughDetail) {
    softWarnings.push('hint-too-short')
  }

  const sourceScale = sourcePrompt ? getSourceScale(sourcePrompt) : null
  const sourceIsHigherScale = sourceScale !== null ? sourceScale >= 4 : false
  if (sourceExists && !sourceIsHigherScale) {
    hardFailures.push(`source-not-higher-scale:${sourceScale ?? 'unknown'}`)
  }

  const targetScaleMatchesId = candidate.id.toLowerCase().includes(candidate.targetScale.toLowerCase())
  if (!targetScaleMatchesId) {
    softWarnings.push('id-target-scale-mismatch')
  }

  const normalizedCombined = normalizeWord(`${candidate.input} ${candidate.hint}`)
  const avoidsGenericTemplateLanguage = !GENERIC_TEMPLATE_PATTERNS.some((pattern) =>
    normalizedCombined.includes(normalizeWord(pattern)),
  )
  if (!avoidsGenericTemplateLanguage) {
    softWarnings.push('generic-template-language')
  }

  const sourceAnchors = sourcePrompt ? buildLexicalAnchorSet(sourcePrompt) : new Set<string>()
  const derivedWords = new Set(normalizedCombined.split(/\s+/).filter((value) => value.length >= 4))
  const hasSourceLexicalAnchor = Array.from(derivedWords).some((word) => sourceAnchors.has(word))
  if (sourceExists && !hasSourceLexicalAnchor) {
    softWarnings.push('weak-lexical-anchor')
  }

  const passedChecks = [
    sourceExists,
    idIsUnique,
    inputHasEnoughDetail,
    hintHasEnoughDetail,
    sourceIsHigherScale,
    targetScaleMatchesId,
    avoidsGenericTemplateLanguage,
    hasSourceLexicalAnchor,
  ].filter(Boolean).length

  const score = Number((passedChecks / 8).toFixed(3))

  return DeterministicCheckSchema.parse({
    pass: hardFailures.length === 0,
    hardFailures,
    softWarnings,
    checks: {
      sourceExists,
      idIsUnique,
      inputHasEnoughDetail,
      hintHasEnoughDetail,
      sourceIsHigherScale,
      targetScaleMatchesId,
      avoidsGenericTemplateLanguage,
      hasSourceLexicalAnchor,
    },
    score,
  })
}

const parseArgs = () => {
  const args = Bun.argv.slice(2)
  let candidatesPath = DEFAULT_INPUT
  let sourcePath = DEFAULT_SOURCE_CATALOG
  let outputPath = DEFAULT_OUTPUT
  let progress = true

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--candidates' && args[index + 1]) {
      candidatesPath = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--source' && args[index + 1]) {
      sourcePath = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--output' && args[index + 1]) {
      outputPath = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--quiet') {
      progress = false
    }
  }

  return { candidatesPath, sourcePath, outputPath, progress }
}

const loadPromptCatalog = async (path: string): Promise<Map<string, PromptCase>> => {
  const text = await Bun.file(path).text()
  const rows = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => PromptCaseSchema.parse(JSON.parse(line)))

  return new Map(rows.map((row) => [row.id, row]))
}

const loadDerivedCandidates = async (path: string): Promise<DerivedPromptCandidate[]> => {
  const text = await Bun.file(path).text()

  if (path.endsWith('.jsonl')) {
    return text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => DerivedPromptCandidateSchema.parse(JSON.parse(line)))
  }

  const parsed = JSON.parse(text) as unknown
  const bundle = z
    .object({
      prompts: z.array(DerivedPromptCandidateSchema),
    })
    .parse(parsed)

  return bundle.prompts
}

const createTaskDescription = (candidate: DerivedPromptCandidate, sourcePrompt: PromptCase) =>
  [
    `Evaluate whether this derived prompt is worth keeping for the modnet catalog.`,
    `Source prompt id: ${sourcePrompt.id}`,
    `Candidate id: ${candidate.id}`,
    `Target scale: ${candidate.targetScale}`,
  ].join('\n')

const summarizeFamilies = (evaluations: DerivedPromptEvaluation[]) => {
  const counts = new Map<string, number>()

  for (const evaluation of evaluations) {
    const family =
      typeof evaluation.sourcePrompt.metadata?.patternFamily === 'string'
        ? evaluation.sourcePrompt.metadata.patternFamily
        : 'unknown'
    counts.set(family, (counts.get(family) ?? 0) + 1)
  }

  return Object.fromEntries(Array.from(counts.entries()).sort((left, right) => right[1] - left[1]))
}

const logProgress = ({ enabled, message }: { enabled: boolean; message: string }) => {
  if (!enabled) {
    return
  }

  console.error(`[modnet-derive-eval] ${message}`)
}

const main = async () => {
  const { candidatesPath, sourcePath, outputPath, progress } = parseArgs()
  logProgress({
    enabled: progress,
    message: `loading source catalog from ${sourcePath}`,
  })
  const sourceCatalog = await loadPromptCatalog(sourcePath)
  logProgress({
    enabled: progress,
    message: `loading candidates from ${candidatesPath}`,
  })
  const candidates = await loadDerivedCandidates(candidatesPath)
  logProgress({
    enabled: progress,
    message: `loaded ${candidates.length} candidate(s)`,
  })
  const seenIds = new Set<string>()
  const evaluations: DerivedPromptEvaluation[] = []
  await resetJsonlOutput(outputPath)

  for (const [index, candidate] of candidates.entries()) {
    logProgress({
      enabled: progress,
      message: `candidate ${index + 1}/${candidates.length}: ${candidate.id} precheck`,
    })
    const sourcePrompt = sourceCatalog.get(candidate.sourceId)
    const deterministicCheck = assessDerivedPromptCandidate({
      candidate,
      sourcePrompt,
      seenIds,
    })
    seenIds.add(candidate.id)

    if (!sourcePrompt) {
      logProgress({
        enabled: progress,
        message: `candidate ${index + 1}/${candidates.length}: ${candidate.id} blocked (missing source)`,
      })
      const evaluation = DerivedPromptEvaluationSchema.parse({
        candidate,
        sourcePrompt: PromptCaseSchema.parse({
          id: candidate.sourceId,
          input: '',
        }),
        deterministicCheck,
        recommended: false,
      })
      evaluations.push(evaluation)
      await appendJsonlRow(outputPath, evaluation)
      continue
    }

    if (!deterministicCheck.pass) {
      logProgress({
        enabled: progress,
        message: `candidate ${index + 1}/${candidates.length}: ${candidate.id} blocked (${deterministicCheck.hardFailures.join(', ')})`,
      })
      const evaluation = DerivedPromptEvaluationSchema.parse({
        candidate,
        sourcePrompt,
        deterministicCheck,
        recommended: false,
      })
      evaluations.push(evaluation)
      await appendJsonlRow(outputPath, evaluation)
      continue
    }

    const task = createTaskDescription(candidate, sourcePrompt)
    const metadata = {
      sourcePrompt,
      candidatePrompt: candidate,
      deterministicCheck,
    }

    logProgress({
      enabled: progress,
      message: `candidate ${index + 1}/${candidates.length}: ${candidate.id} judge`,
    })
    const judge = await judgeDerivedPrompt({
      input: task,
      output: JSON.stringify(candidate, null, 2),
      metadata,
    })
    logProgress({
      enabled: progress,
      message: `candidate ${index + 1}/${candidates.length}: ${candidate.id} meta-verifier`,
    })
    const metaVerification = await metaVerifyDerivedPrompt({
      input: task,
      output: JSON.stringify(judge, null, 2),
      metadata: {
        ...metadata,
        judgeResult: judge,
      },
    })

    const evaluation = DerivedPromptEvaluationSchema.parse({
      candidate,
      sourcePrompt,
      deterministicCheck,
      judge,
      metaVerification,
      recommended: deterministicCheck.pass && judge.pass && metaVerification.pass,
    })
    evaluations.push(evaluation)
    await appendJsonlRow(outputPath, evaluation)
    logProgress({
      enabled: progress,
      message: `candidate ${index + 1}/${candidates.length}: ${candidate.id} done judge=${judge.pass} meta=${metaVerification.pass}`,
    })
  }

  logProgress({
    enabled: progress,
    message: `wrote ${evaluations.length} evaluation row(s) to ${outputPath}`,
  })

  const recommended = evaluations.filter((entry) => entry.recommended).length
  const blockedDeterministically = evaluations.filter((entry) => !entry.deterministicCheck.pass).length
  const judgePassed = evaluations.filter((entry) => entry.judge?.pass === true).length
  const metaPassed = evaluations.filter((entry) => entry.metaVerification?.pass === true).length

  console.log(
    JSON.stringify(
      {
        candidatesPath,
        sourcePath,
        outputPath,
        totalCandidates: evaluations.length,
        blockedDeterministically,
        judgePassed,
        metaPassed,
        recommended,
        sourceFamilies: summarizeFamilies(evaluations),
      },
      null,
      2,
    ),
  )
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
