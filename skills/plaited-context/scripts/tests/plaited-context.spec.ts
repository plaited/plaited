import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'

import { assembleTaskContext } from '../context.ts'
import { exportReview } from '../export-review.ts'
import { initDb } from '../init-db.ts'
import { closeContextDatabase, openContextDatabase, resolveOperationalContext } from '../plaited-context.ts'
import { recordFindingEntry } from '../record-finding.ts'
import { scanWorkspace } from '../scan.ts'
import { searchWorkspace } from '../search.ts'

const tempDirs: string[] = []

const writeTempFile = async ({ path, content }: { path: string; content: string }) => {
  await mkdir(dirname(path), { recursive: true })
  await Bun.write(path, content)
}

const createTempWorkspace = async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'plaited-context-'))
  tempDirs.push(rootDir)

  await writeTempFile({
    path: join(rootDir, 'src/example.ts'),
    content: `export const useBehavioralContext = () => 'behavioral context'
export const reportSnapshot = () => 'snapshot'
`,
  })

  await writeTempFile({
    path: join(rootDir, 'AGENTS.md'),
    content: `# Agent Instructions

Root operational guidance.
`,
  })

  await writeTempFile({
    path: join(rootDir, 'src/worker/AGENTS.md'),
    content: `# Worker Agent Instructions

Scoped instructions for src/worker.
`,
  })

  await writeTempFile({
    path: join(rootDir, 'src/worker/example.ts'),
    content: `export const workerExample = () => 'worker example'
`,
  })

  await writeTempFile({
    path: join(rootDir, 'skills/example-skill/SKILL.md'),
    content: `---
name: example-skill
description: Example skill for behavioral review.
license: ISC
compatibility: Requires bun
---

# Example Skill
`,
  })

  await writeTempFile({
    path: join(rootDir, 'docs/example.md'),
    content: `# Example Doc

Use the behavioral context helper during review.
`,
  })

  return rootDir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('plaited-context scripts', () => {
  test('resolveOperationalContext honors explicit dbPath override', async () => {
    const context = await resolveOperationalContext({
      cwd: process.cwd(),
      dbPath: '/tmp/plaited-context-override.sqlite',
    })

    expect(context.dbPath).toBe('/tmp/plaited-context-override.sqlite')
    expect(context.workspaceRoot.length).toBeGreaterThan(0)
  })

  test('resolveOperationalContext supports explicit packageRoot without forcing repo mode', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'plaited-context-workspace-'))
    tempDirs.push(workspaceDir)

    const packageRoot = join(workspaceDir, 'node_modules/plaited')
    await mkdir(packageRoot, { recursive: true })

    const context = await resolveOperationalContext({
      cwd: workspaceDir,
      packageRoot,
    })

    expect(context.mode).toBe('package')
    expect(context.packageRoot).toBe(packageRoot)
    expect(context.dbPath.startsWith(join(workspaceDir, '.plaited'))).toBe(true)
    expect(context.dbPath.includes('/node_modules/')).toBe(false)
  })

  test('resolveOperationalContext does not force repo mode from script location outside repo cwd', async () => {
    const externalCwd = await mkdtemp(join(tmpdir(), 'plaited-context-external-'))
    tempDirs.push(externalCwd)

    const workspaceContext = await resolveOperationalContext({
      cwd: externalCwd,
    })
    expect(workspaceContext.mode).toBe('workspace')
    expect(workspaceContext.repoRoot).toBeUndefined()
    expect(workspaceContext.dbPath.startsWith(join(externalCwd, '.plaited'))).toBe(true)

    const explicitModeContext = await resolveOperationalContext({
      cwd: externalCwd,
      mode: 'repo',
    })
    expect(explicitModeContext.mode).toBe('repo')

    const explicitRepoContext = await resolveOperationalContext({
      cwd: externalCwd,
      repoRoot: process.cwd(),
    })
    expect(explicitRepoContext.mode).toBe('repo')
    expect(explicitRepoContext.repoRoot).toBeDefined()
    expect(explicitRepoContext.repoRoot ?? '').toBe(process.cwd())
  })

  test('resolveOperationalContext keeps repo mode behavior when cwd is inside repo', async () => {
    const context = await resolveOperationalContext({
      cwd: process.cwd(),
    })

    expect(context.mode).toBe('repo')
    expect(context.repoRoot).toBeDefined()
    expect(context.workspaceRoot).toBe(context.repoRoot ?? '')
  })

  test('indexes workspace and exports recorded findings', async () => {
    const rootDir = await createTempWorkspace()
    const dbPath = join(rootDir, '.plaited/context.sqlite')

    const initOutput = await initDb({
      cwd: rootDir,
      dbPath,
    })

    expect(initOutput.ok).toBe(true)
    expect(initOutput.dbPath).toBe(dbPath)

    const scanOutput = await scanWorkspace({
      cwd: rootDir,
      rootDir,
      dbPath,
      include: ['AGENTS.md', 'src', 'skills', 'docs'],
      force: true,
    })

    expect(scanOutput.ok).toBe(true)
    expect(scanOutput.filesIndexed).toBeGreaterThan(0)
    expect(scanOutput.symbolsIndexed).toBeGreaterThan(0)
    expect(scanOutput.skillsIndexed).toBeGreaterThan(0)
    expect(scanOutput.wikiIndexed).toBeGreaterThan(0)

    const searchOutput = await searchWorkspace({
      cwd: rootDir,
      dbPath,
      query: 'Example Doc',
      limit: 20,
      rootDir,
      fallbackToRipgrep: false,
    })

    expect(searchOutput.ok).toBe(true)
    expect(searchOutput.results.length).toBeGreaterThan(0)
    expect(searchOutput.results.some((row) => row.source === 'wiki')).toBe(true)

    const contextOutput = await assembleTaskContext({
      cwd: rootDir,
      dbPath,
      task: 'review behavioral runtime boundary',
      mode: 'review',
      paths: ['src/example.ts'],
    })

    expect(contextOutput.ok).toBe(true)
    expect(contextOutput.filesToRead).toContain('src/example.ts')
    expect(contextOutput.commandsToRun.some((command) => command.includes('./bin/plaited.ts git'))).toBe(true)

    const findingOutput = await recordFindingEntry({
      cwd: rootDir,
      dbPath,
      finding: {
        kind: 'pattern',
        status: 'candidate',
        summary: 'Use reportSnapshot for diagnostics.',
        evidence: [{ path: 'src/example.ts', line: 2, symbol: 'reportSnapshot' }],
      },
    })

    expect(findingOutput.ok).toBe(true)
    expect(findingOutput.evidenceCount).toBe(1)

    await expect(
      recordFindingEntry({
        cwd: rootDir,
        dbPath,
        finding: {
          kind: 'pattern',
          status: 'validated',
          summary: 'Validated findings need evidence.',
          evidence: [],
        },
      }),
    ).rejects.toThrow('Validated or retired findings require at least one evidence item.')

    const exportOutput = await exportReview({
      cwd: rootDir,
      dbPath,
      status: ['candidate'],
      format: 'json',
    })

    expect(exportOutput.ok).toBe(true)
    expect(exportOutput.findings.length).toBe(1)
    expect(exportOutput.findings[0]?.summary).toContain('reportSnapshot')
    expect(exportOutput.contextRuns.length).toBeGreaterThan(0)
    expect(exportOutput.wikiContext.ok).toBe(true)
    expect(Array.isArray(exportOutput.wikiContext.cleanupCandidates)).toBe(true)
  })

  test('scan rejects include paths that escape rootDir and does not index outside files', async () => {
    const rootDir = await createTempWorkspace()
    const dbPath = join(rootDir, '.plaited/context.sqlite')
    const outsideDir = await mkdtemp(join(tmpdir(), 'plaited-context-outside-'))
    tempDirs.push(outsideDir)
    const outsideFilePath = join(outsideDir, 'outside-context-escape.ts')
    const escapeInclude = relative(rootDir, outsideFilePath)
    const outsideMarker = 'OUTSIDE_CONTEXT_ESCAPE_MARKER'

    await writeTempFile({
      path: outsideFilePath,
      content: `export const outsideMarker = '${outsideMarker}'`,
    })

    await initDb({
      cwd: rootDir,
      dbPath,
    })

    await expect(
      scanWorkspace({
        cwd: rootDir,
        rootDir,
        dbPath,
        include: [escapeInclude],
        force: true,
      }),
    ).rejects.toThrow(`Invalid include path '${escapeInclude}': path escapes rootDir.`)

    const searchOutput = await searchWorkspace({
      cwd: rootDir,
      dbPath,
      query: outsideMarker,
      limit: 5,
      rootDir,
      fallbackToRipgrep: false,
    })

    expect(searchOutput.results).toHaveLength(0)
  })

  test('scan rejects absolute include paths', async () => {
    const rootDir = await createTempWorkspace()
    const dbPath = join(rootDir, '.plaited/context.sqlite')

    await initDb({
      cwd: rootDir,
      dbPath,
    })

    await expect(
      scanWorkspace({
        cwd: rootDir,
        rootDir,
        dbPath,
        include: [join(rootDir, 'src')],
        force: true,
      }),
    ).rejects.toThrow('absolute paths are not allowed')
  })

  test('scan still indexes valid relative include paths', async () => {
    const rootDir = await createTempWorkspace()
    const dbPath = join(rootDir, '.plaited/context.sqlite')

    await initDb({
      cwd: rootDir,
      dbPath,
    })

    const scanOutput = await scanWorkspace({
      cwd: rootDir,
      rootDir,
      dbPath,
      include: ['./src'],
      force: true,
    })

    expect(scanOutput.ok).toBe(true)
    expect(scanOutput.filesIndexed).toBeGreaterThan(0)
    expect(scanOutput.symbolsIndexed).toBeGreaterThan(0)
  })

  test('scan supports explicit root AGENTS.md include and indexes root instruction scope', async () => {
    const rootDir = await createTempWorkspace()
    const dbPath = join(rootDir, '.plaited/context.sqlite')

    await initDb({
      cwd: rootDir,
      dbPath,
    })

    const scanOutput = await scanWorkspace({
      cwd: rootDir,
      rootDir,
      dbPath,
      include: ['AGENTS.md'],
      force: true,
    })

    expect(scanOutput.ok).toBe(true)
    expect(scanOutput.filesIndexed).toBeGreaterThan(0)

    const db = await openContextDatabase({ dbPath })
    try {
      const rootAgentsKind = db.query(`SELECT kind FROM files WHERE path = 'AGENTS.md'`).get() as {
        kind: string
      } | null
      const rootAgentScope = db.query(`SELECT scope_path FROM agent_instructions WHERE path = 'AGENTS.md'`).get() as {
        scope_path: string
      } | null

      expect(rootAgentsKind?.kind).toBe('agent-instructions')
      expect(rootAgentScope?.scope_path).toBe('.')
    } finally {
      closeContextDatabase(db)
    }
  })

  test('scan supports explicit nested AGENTS.md file includes and indexes nested instruction scope', async () => {
    const rootDir = await createTempWorkspace()
    const dbPath = join(rootDir, '.plaited/context.sqlite')

    await initDb({
      cwd: rootDir,
      dbPath,
    })

    const scanOutput = await scanWorkspace({
      cwd: rootDir,
      rootDir,
      dbPath,
      include: ['src/worker/AGENTS.md'],
      force: true,
    })

    expect(scanOutput.ok).toBe(true)
    expect(scanOutput.filesIndexed).toBeGreaterThan(0)

    const db = await openContextDatabase({ dbPath })
    try {
      const nestedAgentScope = db
        .query(`SELECT scope_path FROM agent_instructions WHERE path = 'src/worker/AGENTS.md'`)
        .get() as { scope_path: string } | null

      expect(nestedAgentScope?.scope_path).toBe('src/worker')
    } finally {
      closeContextDatabase(db)
    }
  })

  test('scan supports explicit directory includes and indexes AGENTS.md found under that directory', async () => {
    const rootDir = await createTempWorkspace()
    const dbPath = join(rootDir, '.plaited/context.sqlite')

    await initDb({
      cwd: rootDir,
      dbPath,
    })

    const scanOutput = await scanWorkspace({
      cwd: rootDir,
      rootDir,
      dbPath,
      include: ['src'],
      force: true,
    })

    expect(scanOutput.ok).toBe(true)
    expect(scanOutput.filesIndexed).toBeGreaterThan(0)

    const db = await openContextDatabase({ dbPath })
    try {
      const nestedAgentScope = db
        .query(`SELECT scope_path FROM agent_instructions WHERE path = 'src/worker/AGENTS.md'`)
        .get() as { scope_path: string } | null

      expect(nestedAgentScope?.scope_path).toBe('src/worker')
    } finally {
      closeContextDatabase(db)
    }
  })

  test('context recommends boundary review commands for runtime boundary review tasks', async () => {
    const rootDir = await createTempWorkspace()
    const dbPath = join(rootDir, '.plaited/context.sqlite')

    await initDb({
      cwd: rootDir,
      dbPath,
    })

    await scanWorkspace({
      cwd: rootDir,
      rootDir,
      dbPath,
      include: ['AGENTS.md', 'src', 'skills', 'docs'],
      force: true,
    })

    const contextOutput = await assembleTaskContext({
      cwd: rootDir,
      dbPath,
      task: 'review runtime boundary diagnostics',
      mode: 'review',
      paths: ['src/worker/example.ts'],
    })

    expect(contextOutput.commandsToRun).toContain('bun --bun tsc --noEmit')
    expect(contextOutput.commandsToRun).toContain('bun test <targeted-files-or-surface>')
    expect(contextOutput.commandsToRun.some((command) => command.includes('./bin/plaited.ts git'))).toBe(true)
    expect(
      contextOutput.commandsToRun.some(
        (command) => command.includes('skills/typescript-lsp/scripts/run.ts') && command.includes('"type":"symbols"'),
      ),
    ).toBe(true)
    expect(
      contextOutput.commandsToRun.some(
        (command) =>
          command.includes('skills/typescript-lsp/scripts/run.ts') && command.includes('"type":"references"'),
      ),
    ).toBe(true)
    expect(
      contextOutput.commandsToRun.some(
        (command) =>
          command.includes('skills/typescript-lsp/scripts/run.ts') && command.includes('"type":"definition"'),
      ),
    ).toBe(true)

    const sourceIndex = contextOutput.sourceOfTruth.indexOf('src/ (code)')
    const agentsIndex = contextOutput.sourceOfTruth.indexOf('AGENTS.md (operational instructions)')
    const skillsIndex = contextOutput.sourceOfTruth.indexOf('skills/*/SKILL.md (operational skill instructions)')
    const docsIndex = contextOutput.sourceOfTruth.indexOf(
      'docs/ (wiki/reference; lower authority than code, AGENTS.md, and skills)',
    )

    expect(sourceIndex).toBeGreaterThanOrEqual(0)
    expect(agentsIndex).toBeGreaterThan(sourceIndex)
    expect(skillsIndex).toBeGreaterThan(agentsIndex)
    expect(docsIndex).toBeGreaterThan(skillsIndex)

    expect(contextOutput.authorityOrder.map((entry) => entry.authority)).toEqual([
      'source',
      'agent-instructions',
      'skill',
      'wiki',
      'other',
    ])
    expect(contextOutput.authorityPolicy).toContain('outrank')
  })

  test('context recommends git-context command for implementation mode', async () => {
    const rootDir = await createTempWorkspace()
    const dbPath = join(rootDir, '.plaited/context.sqlite')

    await initDb({
      cwd: rootDir,
      dbPath,
    })

    await scanWorkspace({
      cwd: rootDir,
      rootDir,
      dbPath,
      include: ['AGENTS.md', 'src', 'skills', 'docs'],
      force: true,
    })

    const contextOutput = await assembleTaskContext({
      cwd: rootDir,
      dbPath,
      task: 'implement git context output formatter',
      mode: 'implement',
      paths: ['skills/plaited-context'],
    })

    expect(contextOutput.ok).toBe(true)
    expect(contextOutput.commandsToRun.some((command) => command.includes('./bin/plaited.ts git'))).toBe(true)
    expect(contextOutput.commandsToRun).toContain('bun --bun tsc --noEmit')
    expect(contextOutput.commandsToRun).toContain('bun test <targeted-files-or-surface>')
    expect(contextOutput.commandsToRun).toContain('bun skills/plaited-context/scripts/search.ts')
  })
})
