#!/usr/bin/env bun

import { join } from 'node:path'

type PromptRow = {
  id: string
  input: string
  hint?: string
  metadata?: {
    tier?: string
    promptSource?: string
    patternFamily?: string
    judge?: {
      requiredConcepts?: string[]
    }
  }
}

type DerivedPrompt = {
  id: string
  sourceId: string
  targetScale: 'S1' | 'S2' | 'S3'
  input: string
  hint: string
}

const DEFAULT_INPUT = join(import.meta.dir, '..', 'dev-research', 'modnet', 'catalog', 'modnet-training-prompts.jsonl')

const readRows = async (path: string): Promise<PromptRow[]> => {
  const text = await Bun.file(path).text()
  return text
    .trim()
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as PromptRow)
}

const hasScaleAtLeast = (row: PromptRow): boolean => {
  const required = row.metadata?.judge?.requiredConcepts ?? []
  return required.some((entry) => /^scale-S[4-8]$/i.test(entry))
}

const deriveFamilyPrompts = (row: PromptRow): DerivedPrompt[] => {
  const family = row.metadata?.patternFamily ?? 'developer-utility'

  switch (family) {
    case 'business-process':
      return [
        {
          id: `${row.id}-derived-s1`,
          sourceId: row.id,
          targetScale: 'S1',
          input: 'Show one work item with its owner, status, due date, and notes.',
          hint: 'Derived S1 precursor. Single object card for the larger work-coordination prompt family.',
        },
        {
          id: `${row.id}-derived-s2`,
          sourceId: row.id,
          targetScale: 'S2',
          input: 'List the work items that need review and let me sort them by owner or due date.',
          hint: 'Derived S2 precursor. Ordered review queue for the larger work-coordination prompt family.',
        },
        {
          id: `${row.id}-derived-s3`,
          sourceId: row.id,
          targetScale: 'S3',
          input: 'Build a grouped review board that shows work items by stage.',
          hint: 'Derived S3 precursor. Block-level review surface for the larger work-coordination prompt family.',
        },
      ]
    case 'personal-data-manager':
      return [
        {
          id: `${row.id}-derived-s1`,
          sourceId: row.id,
          targetScale: 'S1',
          input: 'Show one personal or household item with its key details in a single card.',
          hint: 'Derived S1 precursor. Single object view for the larger personal-data-manager prompt family.',
        },
        {
          id: `${row.id}-derived-s2`,
          sourceId: row.id,
          targetScale: 'S2',
          input: 'Make a list or album view for the items in this collection and let me browse them clearly.',
          hint: 'Derived S2 precursor. Object-group view for the larger personal-data-manager prompt family.',
        },
        {
          id: `${row.id}-derived-s3`,
          sourceId: row.id,
          targetScale: 'S3',
          input: 'Build the shared household or family block that brings the related lists and views together.',
          hint: 'Derived S3 precursor. Block-level grouping for the larger personal-data-manager prompt family.',
        },
      ]
    case 'communication':
      return [
        {
          id: `${row.id}-derived-s1`,
          sourceId: row.id,
          targetScale: 'S1',
          input: 'Show one public capability or one message thread entry with the most important context visible.',
          hint: 'Derived S1 precursor. Singular object for the larger communication or network prompt family.',
        },
        {
          id: `${row.id}-derived-s2`,
          sourceId: row.id,
          targetScale: 'S2',
          input: 'List the nearby conversations or available services and let me filter them by type.',
          hint: 'Derived S2 precursor. Browsable group for the larger communication or network prompt family.',
        },
        {
          id: `${row.id}-derived-s3`,
          sourceId: row.id,
          targetScale: 'S3',
          input: 'Build the discovery block that groups nearby services or conversation surfaces into one view.',
          hint: 'Derived S3 precursor. Block-level aggregation for the larger communication or network prompt family.',
        },
      ]
    default:
      return [
        {
          id: `${row.id}-derived-s1`,
          sourceId: row.id,
          targetScale: 'S1',
          input: 'Show the smallest useful single object that this larger module would be built from.',
          hint: 'Derived S1 precursor candidate.',
        },
        {
          id: `${row.id}-derived-s2`,
          sourceId: row.id,
          targetScale: 'S2',
          input: 'Build the grouped object/list view that this larger module would likely use.',
          hint: 'Derived S2 precursor candidate.',
        },
        {
          id: `${row.id}-derived-s3`,
          sourceId: row.id,
          targetScale: 'S3',
          input: 'Build the block-level surface that organizes the lower-scale components for this larger module.',
          hint: 'Derived S3 precursor candidate.',
        },
      ]
  }
}

const parseArgs = () => {
  const args = Bun.argv.slice(2)
  let inputPath = DEFAULT_INPUT
  let limit = 20

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--input' && args[index + 1]) {
      inputPath = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--limit' && args[index + 1]) {
      limit = Number(args[index + 1]!)
      index += 1
    }
  }

  return { inputPath, limit }
}

const main = async () => {
  const { inputPath, limit } = parseArgs()
  const rows = await readRows(inputPath)
  const seeds = rows.filter(hasScaleAtLeast).slice(0, limit)
  const derived = seeds.flatMap(deriveFamilyPrompts)

  console.log(
    JSON.stringify(
      {
        inputPath,
        seedCount: seeds.length,
        derivedCount: derived.length,
        prompts: derived,
      },
      null,
      2,
    ),
  )
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
