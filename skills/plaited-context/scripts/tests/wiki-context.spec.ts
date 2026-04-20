import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { initDb } from '../init-db.ts'
import { closeContextDatabase, openContextDatabase } from '../plaited-context.ts'
import { scanWorkspace } from '../scan.ts'
import { assembleWikiTaskContext } from '../wiki-context.ts'

const tempDirs: string[] = []

const writeTempFile = async ({ path, content }: { path: string; content: string }) => {
  await mkdir(dirname(path), { recursive: true })
  await Bun.write(path, content)
}

const createWikiWorkspace = async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'plaited-context-wiki-'))
  tempDirs.push(rootDir)
  const outsideDir = await mkdtemp(join(tmpdir(), 'plaited-context-wiki-outside-'))
  tempDirs.push(outsideDir)
  const outsideLinkValue = `../../${basename(outsideDir)}/outside.md`

  await writeTempFile({
    path: join(rootDir, 'src/modules/runtime.ts'),
    content: `export const runtimeModule = () => 'runtime'
`,
  })

  await writeTempFile({
    path: join(rootDir, 'AGENTS.md'),
    content: `# Root Agent Instructions

Operational scope for repository.
`,
  })

  await writeTempFile({
    path: join(rootDir, 'skills/example-skill/SKILL.md'),
    content: `---
name: example-skill
description: Example skill for runtime review.
license: ISC
compatibility: Requires bun
---

# Example Skill
`,
  })

  await writeTempFile({
    path: join(outsideDir, 'outside.md'),
    content: `# Outside File
`,
  })

  await writeTempFile({
    path: join(rootDir, 'docs/guide.md'),
    content: `# Runtime Guide

## Module Layout

Review [runtime module](../src/modules/runtime.ts#main) first.
Check [missing note](./missing-note.md).
Check [outside workspace file](${outsideLinkValue}).
See [example skill](../skills/example-skill/SKILL.md).
Retired reference: \`skills/retired-skill/SKILL.md\`.
`,
  })

  await writeTempFile({
    path: join(rootDir, 'docs/index.md'),
    content: `# Docs Index

Start with [runtime guide](./guide.md).
`,
  })

  await writeTempFile({
    path: join(rootDir, 'docs/orphan.md'),
    content: `# Orphan Doc

No local links here.
`,
  })

  return {
    rootDir,
    outsideLinkValue,
  }
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('wiki-context assembly', () => {
  test('indexes wiki markdown metadata while keeping AGENTS.md separate', async () => {
    const { rootDir, outsideLinkValue } = await createWikiWorkspace()
    const dbPath = join(rootDir, '.plaited/context.sqlite')

    await initDb({ cwd: rootDir, dbPath })
    await scanWorkspace({
      cwd: rootDir,
      rootDir,
      dbPath,
      include: ['AGENTS.md', 'src', 'skills', 'docs'],
      force: true,
    })

    const db = await openContextDatabase({ dbPath })
    try {
      const guideFile = db.query(`SELECT kind FROM files WHERE path = 'docs/guide.md'`).get() as { kind: string } | null
      const rootAgentsFile = db.query(`SELECT kind FROM files WHERE path = 'AGENTS.md'`).get() as {
        kind: string
      } | null
      const guideDoc = db.query(`SELECT title FROM docs WHERE path = 'docs/guide.md'`).get() as { title: string } | null
      const headings = db
        .query(`SELECT heading FROM doc_headings WHERE path = 'docs/guide.md' ORDER BY order_index ASC`)
        .all() as Array<{ heading: string }>
      const links = db
        .query(
          `SELECT link_value, target_path, target_exists
           FROM doc_links
           WHERE path = 'docs/guide.md'
           ORDER BY link_value ASC`,
        )
        .all() as Array<{ link_value: string; target_path: string | null; target_exists: number }>

      expect(guideFile?.kind).toBe('wiki')
      expect(rootAgentsFile?.kind).toBe('agent-instructions')
      expect(guideDoc?.title).toBe('Runtime Guide')
      expect(headings).toEqual([{ heading: 'Runtime Guide' }, { heading: 'Module Layout' }])
      expect(links).toEqual([
        {
          link_value: outsideLinkValue,
          target_path: null,
          target_exists: 0,
        },
        {
          link_value: '../skills/example-skill/SKILL.md',
          target_path: 'skills/example-skill/SKILL.md',
          target_exists: 1,
        },
        {
          link_value: '../src/modules/runtime.ts',
          target_path: 'src/modules/runtime.ts',
          target_exists: 1,
        },
        {
          link_value: 'missing-note.md',
          target_path: 'docs/missing-note.md',
          target_exists: 0,
        },
      ])
    } finally {
      closeContextDatabase(db)
    }
  })

  test('reports deterministic wiki relevance, authority ordering, and cleanup candidates', async () => {
    const { rootDir, outsideLinkValue } = await createWikiWorkspace()
    const dbPath = join(rootDir, '.plaited/context.sqlite')

    await initDb({ cwd: rootDir, dbPath })
    await scanWorkspace({
      cwd: rootDir,
      rootDir,
      dbPath,
      include: ['AGENTS.md', 'src', 'skills', 'docs'],
      force: true,
    })

    const firstOutput = await assembleWikiTaskContext({
      cwd: rootDir,
      dbPath,
      task: 'review runtime module architecture',
      paths: ['src/modules'],
      limit: 10,
    })
    const secondOutput = await assembleWikiTaskContext({
      cwd: rootDir,
      dbPath,
      task: 'review runtime module architecture',
      paths: ['src/modules'],
      limit: 10,
    })

    expect(firstOutput).toEqual(secondOutput)
    expect(firstOutput.wikiPages.some((page) => page.path === 'docs/guide.md')).toBe(true)
    expect(firstOutput.brokenLinks.some((link) => link.path === 'docs/guide.md')).toBe(true)
    expect(
      firstOutput.brokenLinks.some(
        (link) =>
          link.path === 'docs/guide.md' &&
          link.linkValue === outsideLinkValue &&
          link.reason.includes('cannot be resolved to a workspace path'),
      ),
    ).toBe(true)
    expect(firstOutput.cleanupCandidates.some((candidate) => candidate.kind === 'missing-target-file')).toBe(true)
    expect(
      firstOutput.cleanupCandidates.some(
        (candidate) =>
          candidate.path === 'docs/guide.md' &&
          candidate.kind === 'broken-local-link' &&
          candidate.reason.includes('cannot be resolved to a workspace path'),
      ),
    ).toBe(true)
    expect(firstOutput.cleanupCandidates.some((candidate) => candidate.kind === 'retired-skill-reference')).toBe(true)
    expect(firstOutput.cleanupCandidates.some((candidate) => candidate.kind === 'orphan-page')).toBe(true)
    const guidePage = firstOutput.wikiPages.find((page) => page.path === 'docs/guide.md')
    expect(guidePage).toBeDefined()
    expect(guidePage?.outboundLocalReferences).not.toContain(outsideLinkValue)
    expect(firstOutput.authorityPolicy).toContain('outrank')
    expect(firstOutput.sourceOfTruth.map((entry) => entry.authority)).toEqual([
      'source',
      'agent-instructions',
      'skill',
      'wiki',
      'other',
    ])
  })

  test('supports schema introspection for wiki-context script', async () => {
    const inputSchemaText = (
      await Bun.$`bun skills/plaited-context/scripts/wiki-context.ts --schema input`.cwd(process.cwd()).quiet()
    ).stdout.toString()
    const outputSchemaText = (
      await Bun.$`bun skills/plaited-context/scripts/wiki-context.ts --schema output`.cwd(process.cwd()).quiet()
    ).stdout.toString()

    const inputSchema = JSON.parse(inputSchemaText) as {
      properties?: Record<string, unknown>
    }
    const outputSchema = JSON.parse(outputSchemaText) as {
      properties?: Record<string, unknown>
    }

    expect(inputSchema.properties?.task).toBeDefined()
    expect(outputSchema.properties?.wikiPages).toBeDefined()
    expect(outputSchema.properties?.cleanupCandidates).toBeDefined()
  })
})
