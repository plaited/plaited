#!/usr/bin/env bun

import { dirname } from 'node:path'
import { parseCodexExecJsonl } from './codex-cli-adapter.ts'
import { Base1InclusionCandidateSchema, loadRawPromptCards, type RawPromptCard } from './modnet-raw-card-base.ts'
import { resolveRepoPath } from './workspace-paths.ts'

const DEFAULT_SOURCE = resolveRepoPath('dev-research', 'modnet', 'catalog', 'modnet-raw-card-corpus.jsonl')
const DEFAULT_OUTPUT = resolveRepoPath('tmp', 'modnet-raw-card-inclusion-candidates.jsonl')
const CODEX_TIMEOUT_MS = 10 * 60_000

export const extractJsonObject = (value: string): Record<string, unknown> => {
  const trimmed = value.trim()
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/u)
  const candidate = fencedMatch ? fencedMatch[1]!.trim() : trimmed

  const directStart = candidate.indexOf('{')
  const directEnd = candidate.lastIndexOf('}')
  if (directStart === -1 || directEnd === -1 || directEnd < directStart) {
    throw new Error('No JSON object found in Codex output')
  }

  return JSON.parse(candidate.slice(directStart, directEnd + 1)) as Record<string, unknown>
}

export const buildBase1Prompt = (
  rawCard: RawPromptCard,
): string => `You are doing Base 1 raw-card gating for the modnet prompt pipeline.

Use only the raw card title and description below. Do not use source URLs, archive nostalgia, or outside facts.

Return exactly one JSON object with these fields:
- id
- title
- description
- inclusionDecision
- modernAnalog
- coreUserJob
- whyRelevant
- likelyPatternFamily
- likelyStructure
- searchQuerySeed

Rules:
- inclusionDecision must be one of: retain, retain_low_priority, discard
- retain: clear modern module analog + reusable MSS shape
- retain_low_priority: plausible analog, but weaker or niche
- discard: mostly obsolete, no strong modern module value
- obsolete surfaces like fax, dial-up, pagers, or legacy transport can still map to durable jobs such as intake, routing, logging, records, scheduling, billing, or coordination
- do not invent a grand modern product; stay close to the durable user job actually implied by the title and description
- avoid generic analogs like "a private organizer on my phone"
- searchQuerySeed should target the modern workflow/job, not the historical platform

Raw card:
${JSON.stringify(rawCard, null, 2)}

Return JSON only.`

const runCodexGeneration = async (prompt: string) => {
  const proc = Bun.spawn(['codex', 'exec', '--json', '--sandbox', 'workspace-write', '-C', process.cwd(), prompt], {
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env as Record<string, string>,
  })

  const timeout = setTimeout(() => proc.kill(), CODEX_TIMEOUT_MS)
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  clearTimeout(timeout)

  if (exitCode !== 0) {
    throw new Error(`Codex exec failed (${exitCode}): ${stderr.trim() || 'no stderr'}`)
  }

  return parseCodexExecJsonl(stdout)
}

const parseArgs = () => {
  const args = Bun.argv.slice(2)
  let sourcePath = DEFAULT_SOURCE
  let outputPath = DEFAULT_OUTPUT
  let limit: number | null = null
  let concurrency = 3
  let progress = true

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
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
    if (arg === '--limit' && args[index + 1]) {
      limit = Math.max(1, Number(args[index + 1]!))
      index += 1
      continue
    }
    if (arg === '--concurrency' && args[index + 1]) {
      concurrency = Math.max(1, Number(args[index + 1]!))
      index += 1
      continue
    }
    if (arg === '--quiet') {
      progress = false
    }
  }

  return { sourcePath, outputPath, limit, concurrency, progress }
}

const logProgress = ({ enabled, message }: { enabled: boolean; message: string }) => {
  if (enabled) {
    console.error(`[modnet-raw-inclusion-gen] ${message}`)
  }
}

const runConcurrent = async <T, R>({
  items,
  concurrency,
  worker,
}: {
  items: T[]
  concurrency: number
  worker: (item: T, index: number) => Promise<R>
}): Promise<R[]> => {
  const results = new Array<R>(items.length)
  let nextIndex = 0

  const runWorker = async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await worker(items[currentIndex]!, currentIndex)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()))
  return results
}

const main = async () => {
  const { sourcePath, outputPath, limit, concurrency, progress } = parseArgs()
  const sourceRows = await loadRawPromptCards(sourcePath)
  const rows = limit ? sourceRows.slice(0, limit) : sourceRows

  const candidates = await runConcurrent({
    items: rows,
    concurrency,
    worker: async (rawCard, index) => {
      logProgress({
        enabled: progress,
        message: `candidate ${index + 1}/${rows.length}: ${rawCard.id} codex`,
      })
      const parsed = await runCodexGeneration(buildBase1Prompt(rawCard))
      const candidate = Base1InclusionCandidateSchema.parse({
        ...extractJsonObject(parsed.output),
        id: rawCard.id,
        title: rawCard.title,
        description: rawCard.description,
      })
      logProgress({
        enabled: progress,
        message: `candidate ${index + 1}/${rows.length}: ${rawCard.id} done ${candidate.inclusionDecision}`,
      })
      return candidate
    },
  })

  const outputDir = dirname(outputPath)
  if (outputDir && outputDir !== '.') {
    await Bun.$`mkdir -p ${outputDir}`.quiet()
  }

  await Bun.write(outputPath, `${candidates.map((row) => JSON.stringify(row)).join('\n')}\n`)

  const decisionCounts = new Map<string, number>()
  for (const candidate of candidates) {
    decisionCounts.set(candidate.inclusionDecision, (decisionCounts.get(candidate.inclusionDecision) ?? 0) + 1)
  }

  console.log(
    JSON.stringify(
      {
        sourcePath,
        outputPath,
        processedRows: rows.length,
        decisionCounts: Object.fromEntries(Array.from(decisionCounts.entries()).sort((a, b) => b[1] - a[1])),
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
