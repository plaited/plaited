import { describe, expect, test } from 'bun:test'
import {
  buildImprovePrompt,
  checkImproveScope,
  createStageLogger,
  loadImprovementProtocolContext,
  parseSliceScope,
  resolveProgramPath,
} from '../protocol.ts'

describe('improve protocol context', () => {
  test('derives program path from the slice directory by default', () => {
    expect(resolveProgramPath('./dev-research/runtime-taxonomy/slice-4.md')).toBe(
      './dev-research/runtime-taxonomy/program.md',
    )
    expect(resolveProgramPath('./dev-research/skills/slice-1.md')).toBe('./dev-research/skills/program.md')
  })

  test('parses backtick-wrapped scope paths from real slice markdown', async () => {
    const slice = await Bun.file(`${import.meta.dir}/../../../dev-research/runtime-taxonomy/slice-1.md`).text()

    expect(parseSliceScope(slice)).toEqual(['src/runtime/'])
  })

  test('extracts inline code paths from prose scope lines', async () => {
    const slice = await Bun.file(`${import.meta.dir}/../../../dev-research/runtime-taxonomy/slice-3.md`).text()

    expect(parseSliceScope(slice)).toEqual(['src/runtime/', 'src/agent/', 'src/modnet/'])
  })

  test('retains standalone file paths like README.md in slice scope', async () => {
    const slice = await Bun.file(`${import.meta.dir}/../../../dev-research/runtime-taxonomy/slice-6.md`).text()

    expect(parseSliceScope(slice)).toEqual([
      'src/tools/skill-evaluate.ts',
      'src/tools/tests/skill-evaluate.spec.ts',
      'src/cli.ts',
      'README.md',
    ])
  })

  test('loads program, slice, and allowed paths as a reusable protocol context', async () => {
    const context = await loadImprovementProtocolContext({
      defaultAllowedPaths: ['src/improve/'],
      programPath: './dev-research/improve/program.md',
      slicePath: './dev-research/improve/slice-1.md',
    })

    expect(context.program.path).toBe('./dev-research/improve/program.md')
    expect(context.slice.id).toBe('slice-1')
    expect(context.allowedPaths).toEqual([
      'src/improve/',
      'scripts/dev-autoresearch.ts',
      'scripts/codex-cli-adapter.ts',
      'scripts/claude-code-judge.ts',
      'scripts/tests/dev-autoresearch.spec.ts',
    ])
    expect(context.prompt).toContain('Program:')
    expect(context.prompt).toContain('Slice:')
  })
})

describe('improve protocol checks', () => {
  test('rejects out-of-scope file changes', () => {
    expect(checkImproveScope(['src/improve/protocol.ts', 'README.md'], ['src/improve/'])).toEqual({
      passed: false,
      notes: 'Out-of-scope files changed: README.md',
      allowedPaths: ['src/improve/'],
    })
  })

  test('records stage logs even when quiet output is enabled', () => {
    const stageLog: { at: string; stage: string; message: string }[] = []
    const logger = createStageLogger(true, stageLog)

    logger('attempt:start', '1/1')

    expect(stageLog).toHaveLength(1)
    expect(stageLog[0]?.stage).toBe('attempt:start')
    expect(stageLog[0]?.message).toBe('1/1')
    expect(typeof stageLog[0]?.at).toBe('string')
  })

  test('builds the bounded attempt prompt from program and slice text', () => {
    const prompt = buildImprovePrompt('# Program', '# Slice')

    expect(prompt).toContain('Execution mode:')
    expect(prompt).toContain('Program:')
    expect(prompt).toContain('# Slice')
  })
})
