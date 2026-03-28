import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validateEncodedKnowledge } from '../validate-encoding.ts'

describe('validate-encoding', () => {
  let tempDir: string

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'validate-encoding-test-'))
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  test('passes when encoded concepts and relations resolve to real headings', async () => {
    const skillDir = join(tempDir, 'skill')
    await Bun.$`mkdir -p ${join(skillDir, 'references')}`.quiet()

    const sourcePath = join(skillDir, 'SKILL.md')
    const encodedPath = join(skillDir, 'encoded.json')

    await Bun.write(
      sourcePath,
      `# Example Skill

## Purpose

Behavioral programming coordinates through events.

## References

See [Algorithm](references/algorithm.md).
`,
    )

    await Bun.write(
      join(skillDir, 'references', 'algorithm.md'),
      `# Algorithm

## Pattern 1

taskGate uses a phase transition.
`,
    )

    await Bun.write(
      encodedPath,
      JSON.stringify(
        {
          concepts: [
            {
              id: 'bp:concept/event-coordination',
              source: { path: sourcePath, heading: 'Purpose' },
            },
            {
              id: 'bp:pattern/taskGate',
              source: { path: join(skillDir, 'references', 'algorithm.md'), heading: 'Pattern 1' },
            },
          ],
          relations: [
            {
              from: 'bp:pattern/taskGate',
              to: 'bp:concept/event-coordination',
              type: 'dependsOn',
              source: { path: sourcePath, heading: 'References' },
            },
          ],
        },
        null,
        2,
      ),
    )

    const result = await validateEncodedKnowledge({
      sourcePath,
      encodedPath,
      requiredConcepts: ['bp:concept/event-coordination', 'bp:pattern/taskGate'],
    })

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.missingConcepts).toEqual([])
  })

  test('fails when required concepts or provenance headings are missing', async () => {
    const skillDir = join(tempDir, 'invalid-skill')
    await Bun.$`mkdir -p ${skillDir}`.quiet()

    const sourcePath = join(skillDir, 'SKILL.md')
    const encodedPath = join(skillDir, 'encoded.json')

    await Bun.write(
      sourcePath,
      `# Invalid Skill

## Purpose

Only one section exists here.
`,
    )

    await Bun.write(
      encodedPath,
      JSON.stringify(
        {
          concepts: [
            {
              id: 'bp:concept/only-one',
              source: { path: sourcePath, heading: 'Missing Heading' },
            },
          ],
          relations: [],
        },
        null,
        2,
      ),
    )

    const result = await validateEncodedKnowledge({
      sourcePath,
      encodedPath,
      requiredConcepts: ['bp:concept/only-one', 'bp:concept/missing'],
    })

    expect(result.valid).toBe(false)
    expect(result.missingConcepts).toContain('bp:concept/missing')
    expect(result.errors.some((error) => error.includes('Missing Heading'))).toBe(true)
  })
})
