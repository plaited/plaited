import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const scriptsDir = join(import.meta.dir, '..')

describe('research-validate', () => {
  let tempDir: string

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'research-validate-test-'))
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  const createLane = async ({
    lane,
    program,
    slices,
  }: {
    lane: string
    program: string
    slices: Record<string, string>
  }) => {
    const laneDir = join(tempDir, lane)
    await Bun.$`mkdir -p ${laneDir}`.quiet()
    await Bun.write(join(laneDir, 'program.md'), program)
    for (const [name, content] of Object.entries(slices)) {
      await Bun.write(join(laneDir, name), content)
    }
    return laneDir
  }

  const runValidation = async (paths: string | string[]) => {
    const input = JSON.stringify({ paths: Array.isArray(paths) ? paths : [paths] })
    const result = await Bun.$`bun ${scriptsDir}/research-validate.ts ${input}`.quiet().nothrow()
    return { exitCode: result.exitCode, output: JSON.parse(result.text()) as Array<Record<string, unknown>> }
  }

  test('validates a well-formed research lane', async () => {
    const laneDir = await createLane({
      lane: 'native-model',
      program: `# Native Model Improvement Program

## Mission

Test mission

## Separation From Other Programs

Separated

## Core Hypothesis

Hypothesis

## Slice Progression

- Slice 1: first

## Acceptance Criteria

Good

## Safety

Safe
`,
      slices: {
        'slice-1.md': `# Slice 1

## Target

Target

## Scope

- \`src/example.ts\`

## Required

Required

## Preserve

Preserve

## Avoid

Avoid

## Acceptance Criteria

Accept
`,
      },
    })

    const result = await runValidation(laneDir)
    expect(result.exitCode).toBe(0)
    expect(result.output.every((entry) => entry.valid === true)).toBe(true)
  })

  test('reports missing required program headings', async () => {
    const laneDir = await createLane({
      lane: 'broken-program',
      program: `# Broken Program

## Mission

Only one heading
`,
      slices: {
        'slice-1.md': `# Slice 1

## Target

Target

## Scope

- \`src/example.ts\`

## Required

Required

## Preserve

Preserve

## Avoid

Avoid

## Acceptance Criteria

Accept
`,
      },
    })

    const result = await runValidation(laneDir)
    expect(result.exitCode).toBe(1)
    const program = result.output.find((entry) => entry.kind === 'program')
    expect(program?.errors).toContain('Missing required heading: ## Separation From')
  })

  test('reports missing slice numbers in a lane', async () => {
    const laneDir = await createLane({
      lane: 'gapped-lane',
      program: `# Gapped Program

## Mission

Mission

## Separation From Other Programs

Separated

## Core Hypothesis

Hypothesis

## Slice Progression

- Slice 1: first
- Slice 3: third

## Acceptance Criteria

Accept

## Safety

Safe
`,
      slices: {
        'slice-1.md': `# Slice 1

## Target

Target

## Scope

- \`src/one.ts\`

## Required

Required

## Preserve

Preserve

## Avoid

Avoid

## Acceptance Criteria

Accept
`,
        'slice-3.md': `# Slice 3

## Target

Target

## Scope

- \`src/three.ts\`

## Required

Required

## Preserve

Preserve

## Avoid

Avoid

## Acceptance Criteria

Accept
`,
      },
    })

    const result = await runValidation(laneDir)
    expect(result.exitCode).toBe(1)
    const lane = result.output.find((entry) => entry.kind === 'lane')
    expect(lane?.errors).toContain('Missing slice numbers: 2')
  })
})
