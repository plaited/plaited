import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
    const slice = `# Slice 1

## Target

Test target.

## Scope

- \`src/runtime/\`

## Acceptance Criteria

- Works.
`

    expect(parseSliceScope(slice)).toEqual(['src/runtime/'])
  })

  test('extracts inline code paths from prose scope lines', async () => {
    const slice = `# Slice 3

## Target

Test target.

## Scope

- Keep work inside \`src/runtime/\`, \`src/agent/\`, and \`src/modnet/\`.

## Acceptance Criteria

- Works.
`

    expect(parseSliceScope(slice)).toEqual(['src/runtime/', 'src/agent/', 'src/modnet/'])
  })

  test('retains standalone file paths like README.md in slice scope', async () => {
    const slice = `# Slice 6

## Target

Test target.

## Scope

- src/tools/skill-evaluate.ts
- src/tools/tests/skill-evaluate.spec.ts
- src/cli.ts
- README.md

## Acceptance Criteria

- Works.
`

    expect(parseSliceScope(slice)).toEqual([
      'src/tools/skill-evaluate.ts',
      'src/tools/tests/skill-evaluate.spec.ts',
      'src/cli.ts',
      'README.md',
    ])
  })

  test('loads program, slice, and allowed paths as a reusable protocol context', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'improve-protocol-'))
    const programPath = join(tempDir, 'program.md')
    const slicePath = join(tempDir, 'slice-1.md')

    await Bun.write(
      programPath,
      `# Program

## Mission

Do the thing.

## Fixed Architecture

Keep it bounded.

## Runtime Taxonomy

None.

## Validation

Run checks.
`,
    )

    await Bun.write(
      slicePath,
      `# Slice 1

## Target

One bounded attempt.

## Scope

- scripts/dev-autoresearch.ts
- scripts/codex-cli-adapter.ts
        - scripts/workspace-improvement-judge.ts
- scripts/tests/dev-autoresearch.spec.ts

## Acceptance Criteria

- Prompt loads.
`,
    )

    const context = await loadImprovementProtocolContext({
      defaultAllowedPaths: ['src/improve/'],
      programPath,
      slicePath,
    })

    expect(context.program.path).toBe(programPath)
    expect(context.slice.id).toBe('slice-1')
    expect(context.allowedPaths).toEqual([
      'scripts/dev-autoresearch.ts',
      'scripts/codex-cli-adapter.ts',
      'scripts/workspace-improvement-judge.ts',
      'scripts/tests/dev-autoresearch.spec.ts',
    ])
    expect(context.prompt).toContain('Program:')
    expect(context.prompt).toContain('Slice:')

    rmSync(tempDir, { recursive: true, force: true })
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
