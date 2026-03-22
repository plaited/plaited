#!/usr/bin/env bun

import { dirname, join } from 'node:path'

type PromptRow = {
  id: string
  input: string | string[]
  metadata?: {
    promptSource?: string
    patternFamily?: string
  }
  _source?: {
    title?: string
    description?: string
    mss?: {
      scale?: number
      structure?: string
      mechanics?: string[]
    }
  }
}

type AuditFlag = {
  id: string
  title: string
  currentScale: number | null
  suggestedScale: number
  delta: number
  patternFamily: string
  reasons: string[]
}

const DEFAULT_INPUT = join(import.meta.dir, '..', 'dev-research', 'modnet', 'catalog', 'modnet-training-prompts.jsonl')
const DEFAULT_OUTPUT = join(import.meta.dir, '..', 'tmp', 'hypercard-scale-audit.json')

const SUITE_PATTERNS = [
  /general ledger/i,
  /payroll/i,
  /billing/i,
  /invoice/i,
  /inventory/i,
  /scheduling/i,
  /calendar/i,
  /address book/i,
  /to-do/i,
  /reminder/i,
  /project stacks/i,
  /sub-project/i,
  /cost-analyses/i,
  /complete .* e-book/i,
  /guide[s]? you through/i,
  /maintain, update, and even print/i,
]

const NETWORK_PATTERNS = [/community/i, /network/i, /multi-user/i, /bulletin board/i, /forum/i, /messaging/i]

const flattenInput = (value: string | string[]): string => (Array.isArray(value) ? value.join('\n\n') : value)

const parseRows = async (path: string): Promise<PromptRow[]> => {
  const text = await Bun.file(path).text()
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as PromptRow)
}

const getText = (row: PromptRow): string =>
  [flattenInput(row.input), row._source?.title ?? '', row._source?.description ?? ''].join('\n').toLowerCase()

const countMatchedPatterns = (text: string, patterns: RegExp[]): number =>
  patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0)

export const suggestMinimumScale = (row: PromptRow): { suggestedScale: number; reasons: string[] } => {
  const text = getText(row)
  const reasons: string[] = []
  let suggestedScale = 1

  const currentStructure = row._source?.mss?.structure ?? ''
  const mechanics = Array.isArray(row._source?.mss?.mechanics) ? row._source?.mss?.mechanics : []
  const suiteHits = countMatchedPatterns(text, SUITE_PATTERNS)
  const networkHits = countMatchedPatterns(text, NETWORK_PATTERNS)
  const enumeratedFunctions = (text.match(/,/g) ?? []).length >= 3 || /\band\b/.test(text)

  if (['list', 'collection', 'form', 'thread', 'stream', 'pool', 'hypertext'].includes(currentStructure)) {
    suggestedScale = Math.max(suggestedScale, 2)
    reasons.push(`structure:${currentStructure}`)
  }

  if (['thread', 'stream', 'pool', 'hypertext'].includes(currentStructure)) {
    suggestedScale = Math.max(suggestedScale, 3)
    reasons.push(`structure-needs-block:${currentStructure}`)
  }

  if (mechanics.some((mechanic) => ['contact', 'reply', 'share', 'follow', 'post', 'stream'].includes(mechanic))) {
    suggestedScale = Math.max(suggestedScale, 3)
    reasons.push(`mechanics:${mechanics.join(',')}`)
  }

  if (suiteHits >= 1) {
    suggestedScale = Math.max(suggestedScale, 4)
    reasons.push(`suite-language:${suiteHits}`)
  }

  if (enumeratedFunctions && /(track|record|maintain|organize|manage|create|print|report)/i.test(text)) {
    suggestedScale = Math.max(suggestedScale, 4)
    reasons.push('multi-function-workflow')
  }

  if (networkHits >= 1) {
    suggestedScale = Math.max(suggestedScale, 5)
    reasons.push(`network-language:${networkHits}`)
  }

  return { suggestedScale, reasons }
}

const parseArgs = () => {
  const args = Bun.argv.slice(2)
  let inputPath = DEFAULT_INPUT
  let outputPath = DEFAULT_OUTPUT

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--input' && args[index + 1]) {
      inputPath = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--output' && args[index + 1]) {
      outputPath = args[index + 1]!
      index += 1
    }
  }

  return { inputPath, outputPath }
}

const main = async () => {
  const { inputPath, outputPath } = parseArgs()
  const rows = await parseRows(inputPath)
  const hypercardRows = rows.filter((row) => row.metadata?.promptSource === 'hypercard-archive')
  const flags: AuditFlag[] = []

  for (const row of hypercardRows) {
    const currentScale = typeof row._source?.mss?.scale === 'number' ? row._source.mss.scale : null
    const { suggestedScale, reasons } = suggestMinimumScale(row)

    if (currentScale === null || suggestedScale <= currentScale) {
      continue
    }

    flags.push({
      id: row.id,
      title: row._source?.title ?? row.id,
      currentScale,
      suggestedScale,
      delta: suggestedScale - currentScale,
      patternFamily: row.metadata?.patternFamily ?? 'unknown',
      reasons,
    })
  }

  const outputDir = dirname(outputPath)
  if (outputDir && outputDir !== '.') {
    await Bun.$`mkdir -p ${outputDir}`.quiet()
  }

  await Bun.write(
    outputPath,
    JSON.stringify(
      {
        inputPath,
        hypercardCount: hypercardRows.length,
        flagged: flags.length,
        flags,
      },
      null,
      2,
    ),
  )

  const byDelta = flags.reduce<Record<string, number>>((counts, flag) => {
    const key = `${flag.currentScale}->${flag.suggestedScale}`
    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {})

  const byFamily = flags.reduce<Record<string, number>>((counts, flag) => {
    counts[flag.patternFamily] = (counts[flag.patternFamily] ?? 0) + 1
    return counts
  }, {})

  console.log(
    JSON.stringify(
      {
        inputPath,
        outputPath,
        hypercardCount: hypercardRows.length,
        flagged: flags.length,
        byDelta,
        byFamily,
        sample: flags.slice(0, 15),
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
