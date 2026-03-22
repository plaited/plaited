#!/usr/bin/env bun

import { dirname, join } from 'node:path'

type RawCatalogRow = {
  id?: unknown
  title?: unknown
  description?: unknown
}

type RawPromptCard = {
  id: string
  title: string
  description: string
}

const DEFAULT_HYPERCARD_INPUT = join(
  import.meta.dir,
  '..',
  '.worktrees',
  'hypercard-catalog-task',
  'dev-research',
  'native-model',
  'hypercard-catalog.jsonl',
)
const DEFAULT_MACREPO_INPUT = join(
  import.meta.dir,
  '..',
  '.worktrees',
  'macrepo-catalog-task',
  'dev-research',
  'native-model',
  'macrepo-catalog.jsonl',
)
const DEFAULT_OUTPUT = join(import.meta.dir, '..', 'dev-research', 'modnet', 'catalog', 'modnet-raw-card-corpus.jsonl')

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim()

const parseRawRow = (line: string): RawPromptCard | null => {
  const parsed = JSON.parse(line) as RawCatalogRow

  if (typeof parsed.id !== 'string' || typeof parsed.title !== 'string' || typeof parsed.description !== 'string') {
    return null
  }

  const id = normalizeText(parsed.id)
  const title = normalizeText(parsed.title)
  const description = normalizeText(parsed.description)

  if (!id || !title || !description) {
    return null
  }

  return { id, title, description }
}

const loadJsonl = async (path: string): Promise<RawPromptCard[]> => {
  const text = await Bun.file(path).text()

  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseRawRow)
    .filter((row): row is RawPromptCard => row !== null)
}

const dedupeCards = (rows: RawPromptCard[]): RawPromptCard[] => {
  const seen = new Set<string>()
  const deduped: RawPromptCard[] = []

  for (const row of rows) {
    if (seen.has(row.id)) {
      continue
    }

    seen.add(row.id)
    deduped.push(row)
  }

  return deduped
}

const parseArgs = () => {
  const args = Bun.argv.slice(2)

  let hypercardInput = DEFAULT_HYPERCARD_INPUT
  let macrepoInput = DEFAULT_MACREPO_INPUT
  let outputPath = DEFAULT_OUTPUT
  let includeHypercard = true
  let includeMacrepo = true

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--hypercard-input' && args[index + 1]) {
      hypercardInput = args[index + 1]!
      index += 1
      continue
    }

    if (arg === '--macrepo-input' && args[index + 1]) {
      macrepoInput = args[index + 1]!
      index += 1
      continue
    }

    if (arg === '--output' && args[index + 1]) {
      outputPath = args[index + 1]!
      index += 1
      continue
    }

    if (arg === '--hypercard-only') {
      includeMacrepo = false
      continue
    }

    if (arg === '--macrepo-only') {
      includeHypercard = false
    }
  }

  return {
    hypercardInput,
    macrepoInput,
    outputPath,
    includeHypercard,
    includeMacrepo,
  }
}

const main = async () => {
  const { hypercardInput, macrepoInput, outputPath, includeHypercard, includeMacrepo } = parseArgs()

  const rows: RawPromptCard[] = []

  if (includeHypercard) {
    rows.push(...(await loadJsonl(hypercardInput)))
  }

  if (includeMacrepo) {
    rows.push(...(await loadJsonl(macrepoInput)))
  }

  const deduped = dedupeCards(rows)
  const outputDir = dirname(outputPath)
  if (outputDir && outputDir !== '.') {
    await Bun.$`mkdir -p ${outputDir}`.quiet()
  }

  await Bun.write(outputPath, `${deduped.map((row) => JSON.stringify(row)).join('\n')}\n`)

  console.log(
    JSON.stringify(
      {
        hypercardInput: includeHypercard ? hypercardInput : null,
        macrepoInput: includeMacrepo ? macrepoInput : null,
        outputPath,
        totalRows: rows.length,
        uniqueRows: deduped.length,
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
