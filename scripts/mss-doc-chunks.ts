#!/usr/bin/env bun

import { basename, join, resolve } from 'node:path'
import { extractSectionsFromMarkdown, extractSkillLinksFromMarkdown } from '../src/tools/skill-links.ts'

export type DocChunk = {
  sourcePath: string
  heading: string
  headingPath: string[]
  kind: 'purpose' | 'pattern' | 'rule' | 'reference' | 'example' | 'notes'
  text: string
  xml: string
}

export type DocChunkFile = {
  sourcePath: string
  title: string
  sections: DocChunk[]
  links: Awaited<ReturnType<typeof extractSkillLinksFromMarkdown>>
}

export const DEFAULT_DOC_PATHS = [
  join('docs', 'Structural-IA.md'),
  join('docs', 'Modnet.md'),
  join('docs', 'MODNET-IMPLEMENTATION.md'),
] as const

const parseArgs = (argv: string[]) => {
  let outputPath = join('.prompts', 'mss-doc-chunks', 'chunks.jsonl')
  const docPaths: string[] = []

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (!arg) {
      continue
    }

    if (arg === '--output' && next) {
      outputPath = next
      index += 1
      continue
    }

    docPaths.push(arg)
  }

  return {
    outputPath,
    docPaths: docPaths.length > 0 ? docPaths : [...DEFAULT_DOC_PATHS],
  }
}

export const loadDocChunkFile = async (path: string): Promise<DocChunkFile | null> => {
  const sourcePath = resolve(path)
  const file = Bun.file(sourcePath)
  if (!(await file.exists())) {
    return null
  }

  const content = await file.text()
  const sections = extractSectionsFromMarkdown({ path: sourcePath, content }).map((section) => ({
    sourcePath,
    heading: section.heading,
    headingPath: section.headingPath,
    kind: section.kind,
    text: section.text,
    xml: section.xml,
  }))

  const links = await extractSkillLinksFromMarkdown({ path: sourcePath, content })

  return {
    sourcePath,
    title: basename(sourcePath),
    sections,
    links,
  }
}

export const buildDocChunks = async (paths: string[]) => {
  const files: DocChunkFile[] = []

  for (const path of paths) {
    const chunkFile = await loadDocChunkFile(path)
    if (chunkFile) {
      files.push(chunkFile)
    }
  }

  return files
}

const writeJsonl = async (outputPath: string, files: DocChunkFile[]) => {
  const absoluteOutputPath = resolve(outputPath)
  await Bun.$`mkdir -p ${join(absoluteOutputPath, '..')}`.quiet()

  const rows = files.flatMap((file) =>
    file.sections.map((section) =>
      JSON.stringify({
        sourcePath: section.sourcePath,
        heading: section.heading,
        headingPath: section.headingPath,
        kind: section.kind,
        text: section.text,
        xml: section.xml,
      }),
    ),
  )

  await Bun.write(absoluteOutputPath, `${rows.join('\n')}${rows.length > 0 ? '\n' : ''}`)
  return absoluteOutputPath
}

const printSummary = (files: DocChunkFile[], outputPath: string) => {
  const sections = files.reduce((count, file) => count + file.sections.length, 0)
  const links = files.reduce((count, file) => count + file.links.length, 0)

  console.log(
    JSON.stringify(
      {
        outputPath,
        files: files.map((file) => ({
          sourcePath: file.sourcePath,
          sections: file.sections.length,
          links: file.links.length,
        })),
        totals: {
          files: files.length,
          sections,
          links,
        },
      },
      null,
      2,
    ),
  )
}

const main = async () => {
  const { outputPath, docPaths } = parseArgs(process.argv.slice(2))
  const files = await buildDocChunks(docPaths)
  const writtenPath = await writeJsonl(outputPath, files)
  printSummary(files, writtenPath)
}

if (import.meta.main) {
  await main()
}
