import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildResearchPrompt,
  checkResearchScope,
  createStageLogger,
  loadResearchProgramContext,
  parseProgramScope,
} from '../research-program.ts'

describe('research program context', () => {
  test('parses backtick-wrapped scope paths from program markdown', async () => {
    const program = `# Program

## Mission

Test mission.

## Fixed Architecture

Keep it bounded.

## Scope

- \`src/agent/\`

## Validation

- Works.
`

    expect(parseProgramScope(program)).toEqual(['src/agent/'])
  })

  test('extracts inline code paths from prose scope lines', async () => {
    const program = `# Program

## Mission

Test mission.

## Fixed Architecture

Keep it bounded.

## Scope

- Keep work inside \`src/agent/\` and \`skills/\`.

## Validation

- Works.
`

    expect(parseProgramScope(program)).toEqual(['src/agent/', 'skills/'])
  })

  test('loads program and allowed paths as a reusable context', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'research-program-'))
    const programPath = join(tempDir, 'program.md')

    await Bun.write(
      programPath,
      `# Program

## Mission

Do the thing.

## Fixed Architecture

Keep it bounded.

## Scope

- src/bootstrap/bootstrap.ts
- src/improve/attempt-evaluation.ts
- README.md

## Validation

Run checks.
`,
    )

    const context = await loadResearchProgramContext({
      defaultAllowedPaths: ['src/improve/'],
      programPath,
    })

    expect(context.program.path).toBe(programPath)
    expect(context.program.scopePaths).toEqual([
      'src/bootstrap/bootstrap.ts',
      'src/improve/attempt-evaluation.ts',
      'README.md',
    ])
    expect(context.allowedPaths).toEqual([
      'src/bootstrap/bootstrap.ts',
      'src/improve/attempt-evaluation.ts',
      'README.md',
    ])
    expect(context.prompt).toContain('Program:')

    rmSync(tempDir, { recursive: true, force: true })
  })
})

describe('research program checks', () => {
  test('rejects out-of-scope file changes', () => {
    expect(checkResearchScope(['src/improve/research-program.ts', 'README.md'], ['src/improve/'])).toEqual({
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

  test('builds the bounded attempt prompt from program text', () => {
    const prompt = buildResearchPrompt('# Program')

    expect(prompt).toContain('Execution mode:')
    expect(prompt).toContain('Program:')
    expect(prompt).toContain('# Program')
  })
})
