#!/usr/bin/env bun

import { dirname } from 'node:path'
import { dedupeRawPromptCards, loadRawPromptCards, type RawPromptCard } from './modnet-raw-card-base.ts'
import { resolveRepoPath, resolveWorkspacePath } from './workspace-paths.ts'

const DEFAULT_HYPERCARD_INPUT = resolveWorkspacePath(
  'hypercard-catalog-task',
  'dev-research',
  'native-model',
  'hypercard-catalog.jsonl',
)
const DEFAULT_MACREPO_INPUT = resolveWorkspacePath(
  'macrepo-catalog-task',
  'dev-research',
  'native-model',
  'macrepo-catalog.jsonl',
)
const DEFAULT_OUTPUT = resolveRepoPath('dev-research', 'modnet', 'catalog', 'modnet-raw-card-corpus.jsonl')

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
    rows.push(...(await loadRawPromptCards(hypercardInput)))
  }

  if (includeMacrepo) {
    rows.push(...(await loadRawPromptCards(macrepoInput)))
  }

  const deduped = dedupeRawPromptCards(rows)
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
