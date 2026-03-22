import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { evaluateSkill } from '../skill-evaluate.ts'

describe('skill-evaluate', () => {
  let tempDir: string

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skill-evaluate-test-'))
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  const createRepoFixture = async () => {
    const repoDir = join(tempDir, `repo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    const skillDir = join(repoDir, 'skills', 'demo-skill')
    const evalsDir = join(skillDir, 'evals')
    const scriptsDir = join(repoDir, 'test-scripts')
    await Bun.$`mkdir -p ${evalsDir}`.quiet()
    await Bun.$`mkdir -p ${scriptsDir}`.quiet()

    await Bun.write(
      join(skillDir, 'SKILL.md'),
      `---
name: demo-skill
description: Demo skill for evaluate-skill tests
---

# Demo Skill
`,
    )

    await Bun.write(
      join(evalsDir, 'trigger-prompts.jsonl'),
      `${JSON.stringify({
        id: 'should-trigger',
        input: 'Use the demo skill',
        metadata: { expected: 'visible' },
      })}\n`,
    )

    await Bun.write(
      join(evalsDir, 'output-cases.jsonl'),
      `${JSON.stringify({
        id: 'should-output',
        input: 'Generate with the demo skill',
        metadata: { expected: 'visible' },
      })}\n`,
    )

    await Bun.write(join(evalsDir, 'RUBRIC.md'), '# Demo Rubric\n')

    const adapterPath = join(scriptsDir, 'adapter.ts')
    await Bun.write(
      adapterPath,
      `import { join } from 'node:path'

export const adapt = async ({ cwd }) => {
  const skillPath = join(cwd ?? process.cwd(), 'skills', 'demo-skill', 'SKILL.md')
  const visible = await Bun.file(skillPath).exists()
  return { output: visible ? 'visible' : 'missing' }
}
`,
    )

    const graderPath = join(scriptsDir, 'grader.ts')
    await Bun.write(
      graderPath,
      `export const grade = async ({ output, metadata }) => {
  const expected = typeof metadata?.expected === 'string' ? metadata.expected : 'visible'
  const pass = output === expected
  return {
    pass,
    score: pass ? 1 : 0,
    reasoning: pass ? 'matched expected output' : 'did not match expected output',
    dimensions: { outcome: pass ? 1 : 0 },
  }
}
`,
    )

    await Bun.$`git init ${repoDir}`.quiet()
    await Bun.$`git -C ${repoDir} config user.email skill-eval@example.com`.quiet()
    await Bun.$`git -C ${repoDir} config user.name "Skill Eval Test"`.quiet()
    await Bun.$`git -C ${repoDir} add skills test-scripts`.quiet()
    await Bun.$`git -C ${repoDir} commit -m "test fixture"`.quiet()

    return {
      repoDir,
      skillDir,
      adapterPath,
      graderPath,
    }
  }

  test('evaluates trigger prompts into the skill-local evals/runs directory', async () => {
    const fixture = await createRepoFixture()
    const previousCwd = process.cwd()
    process.chdir(fixture.repoDir)

    try {
      const result = await evaluateSkill({
        skillPath: fixture.skillDir,
        mode: 'trigger',
        adapterPath: fixture.adapterPath,
        graderPath: fixture.graderPath,
        baseline: 'none',
        useWorktree: false,
        keepWorktrees: false,
        commit: true,
        k: 1,
        concurrency: 1,
        progress: false,
      })

      expect(result.runDir).toContain('/skills/demo-skill/evals/runs/')
      expect(await Bun.file(result.resultsMarkdownPath).exists()).toBe(true)
      expect(await Bun.file(result.benchmarkPath).exists()).toBe(true)
      expect(await Bun.file(result.latestResultsPath).exists()).toBe(true)
      expect(await Bun.file(result.latestBenchmarkPath).exists()).toBe(true)
      expect(await Bun.file(result.latestRunPath).exists()).toBe(true)
      expect(result.commitSha).toBeDefined()
      expect(result.runs).toHaveLength(1)
      expect(result.runs[0]?.label).toBe('with-skill')
      expect(result.runs[0]?.summary.passRate).toBe(1)

      const report = await Bun.file(result.resultsMarkdownPath).text()
      expect(report).toContain('# Skill Eval Results')
      expect(report).toContain('## Scenario Summary')
      expect(report).not.toContain('## Scenario Delta')
    } finally {
      process.chdir(previousCwd)
    }
  })

  test('supports a without-skill baseline via worktree masking', async () => {
    const fixture = await createRepoFixture()
    const previousCwd = process.cwd()
    process.chdir(fixture.repoDir)

    try {
      const result = await evaluateSkill({
        skillPath: fixture.skillDir,
        mode: 'trigger',
        adapterPath: fixture.adapterPath,
        graderPath: fixture.graderPath,
        baseline: 'without-skill',
        useWorktree: true,
        keepWorktrees: false,
        commit: true,
        k: 1,
        concurrency: 1,
        progress: false,
      })

      expect(result.runs).toHaveLength(2)
      const withSkill = result.runs.find((run) => run.label === 'with-skill')
      const withoutSkill = result.runs.find((run) => run.label === 'without-skill')
      expect(withSkill?.summary.passRate).toBe(1)
      expect(withoutSkill?.summary.passRate).toBe(0)
      expect(result.commitSha).toBeDefined()

      const benchmark = await Bun.file(result.benchmarkPath).json()
      expect(benchmark.delta.passRate).toBe(1)

      const report = await Bun.file(result.resultsMarkdownPath).text()
      expect(report).toContain('## Scenario Delta')
      expect(report).toContain('## Prompt Delta')
      expect(report).toContain('## Human Review')
    } finally {
      process.chdir(previousCwd)
    }
  })
})
