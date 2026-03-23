#!/usr/bin/env bun

import { appendJsonlRow, resetJsonlOutput } from './jsonl-output.ts'
import { HeldoutRowSchema } from './modnet-judge-ablation.schemas.ts'
import {
  type Base1InclusionCandidate,
  Base1InclusionCandidateSchema,
  loadJsonlRows,
  type RawPromptCard,
  RawPromptCardSchema,
} from './modnet-raw-card-base.ts'
import { assessInclusionCandidate } from './modnet-raw-card-inclusion-evaluate.ts'
import { resolveRepoPath } from './workspace-paths.ts'

const DEFAULT_SOURCE = resolveRepoPath('dev-research', 'modnet', 'catalog', 'modnet-raw-card-corpus.jsonl')
const DEFAULT_CANDIDATES = '/tmp/modnet-raw-card-inclusion-candidates.jsonl'
const DEFAULT_PRIOR = resolveRepoPath(
  'dev-research',
  'modnet',
  'catalog',
  'modnet-judge-ablation-heldout.raw-card-inclusion.jsonl',
)
const DEFAULT_OUTPUT = resolveRepoPath(
  'dev-research',
  'modnet',
  'catalog',
  'modnet-judge-ablation-heldout.raw-card-inclusion.pass2.jsonl',
)

const parseArgs = (args: string[]) => {
  let sourcePath = DEFAULT_SOURCE
  let candidatesPath = DEFAULT_CANDIDATES
  let priorPath = DEFAULT_PRIOR
  let outputPath = DEFAULT_OUTPUT
  let size = 100

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--source' && args[index + 1]) {
      sourcePath = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--candidates' && args[index + 1]) {
      candidatesPath = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--prior' && args[index + 1]) {
      priorPath = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--output' && args[index + 1]) {
      outputPath = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--size' && args[index + 1]) {
      size = Math.max(1, Number(args[index + 1]!))
      index += 1
    }
  }

  return { sourcePath, candidatesPath, priorPath, outputPath, size }
}

const createTaskDescription = (candidate: Base1InclusionCandidate) =>
  [
    'Evaluate whether this raw-card inclusion result is trustworthy enough to keep in the modnet prompt pipeline.',
    `Card id: ${candidate.id}`,
    `Inclusion decision: ${candidate.inclusionDecision}`,
  ].join('\n')

const stratify = <T>(items: T[], size: number): T[] => {
  if (items.length <= size) return items
  const stride = items.length / size
  return Array.from({ length: size }, (_, index) => items[Math.floor(index * stride)]!).filter(Boolean)
}

const main = async () => {
  const { sourcePath, candidatesPath, priorPath, outputPath, size } = parseArgs(Bun.argv.slice(2))
  const rawCards = await loadJsonlRows(sourcePath, RawPromptCardSchema)
  const candidates = await loadJsonlRows(candidatesPath, Base1InclusionCandidateSchema)
  const priorRows = await loadJsonlRows(priorPath, HeldoutRowSchema)
  const priorIds = new Set(priorRows.map((row) => row.id))
  const sourceMap = new Map<string, RawPromptCard>(rawCards.map((row) => [row.id, row]))
  const buckets = new Map<string, Base1InclusionCandidate[]>()
  const seenIds = new Set<string>()

  for (const candidate of candidates) {
    if (priorIds.has(candidate.id)) continue
    const key = candidate.inclusionDecision
    const bucket = buckets.get(key) ?? []
    bucket.push(candidate)
    buckets.set(key, bucket)
  }

  const ordered = ['retain', 'retain_low_priority', 'discard'].flatMap((key) =>
    stratify(buckets.get(key) ?? [], Math.ceil(size / 3)),
  )
  const selected = ordered.slice(0, size)

  await resetJsonlOutput(outputPath)
  for (const candidate of selected) {
    const rawCard =
      sourceMap.get(candidate.id) ??
      RawPromptCardSchema.parse({
        id: candidate.id,
        title: candidate.title,
        description: candidate.description,
      })
    const deterministicCheck = assessInclusionCandidate({
      candidate,
      rawCard,
      seenIds,
    })
    seenIds.add(candidate.id)

    await appendJsonlRow(
      outputPath,
      HeldoutRowSchema.parse({
        id: candidate.id,
        taskKind: 'raw-card-inclusion',
        task: createTaskDescription(candidate),
        candidateOutput: JSON.stringify(candidate, null, 2),
        metadata: {
          rawCard,
          candidate,
          deterministicCheck,
        },
      }),
    )
  }

  console.log(
    JSON.stringify(
      {
        sourcePath,
        candidatesPath,
        priorPath,
        outputPath,
        totalHeldout: selected.length,
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
