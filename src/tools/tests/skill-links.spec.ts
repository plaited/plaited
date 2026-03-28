import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildSkillEncodingSurface, extractSkillLinksFromMarkdown } from '../skill-links.ts'

describe('skill-links', () => {
  let tempDir: string

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skill-links-test-'))
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  test('classifies links by section heading context', async () => {
    const edges = await extractSkillLinksFromMarkdown({
      path: '/tmp/example/SKILL.md',
      content: `# Example Skill

## Setup

See [Install](references/setup.md).

## Example

See [Walkthrough](references/example.md).

## Requirements

See [Dependency Notes](references/deps.md).

## References

See [Reference Guide](references/reference.md).
`,
    })

    expect(edges.map((edge) => edge.type)).toEqual(['setupFor', 'examples', 'dependsOn', 'references'])
  })

  test('builds a local encoding surface across linked markdown files', async () => {
    const rootDir = join(tempDir, 'fixture-skill')
    await Bun.$`mkdir -p ${join(rootDir, 'references')}`.quiet()

    await Bun.write(
      join(rootDir, 'SKILL.md'),
      `---
name: fixture-skill
description: Fixture description
---

# Fixture Skill

## Purpose

Use this for testing.

## Setup

See [Setup Guide](references/setup.md).

## References

See [Reference Guide](references/reference.md).
`,
    )
    await Bun.write(
      join(rootDir, 'references', 'setup.md'),
      `# Setup Guide

## Example

See [Deep Example](example.md).
`,
    )
    await Bun.write(
      join(rootDir, 'references', 'reference.md'),
      `# Reference Guide

No further links.
`,
    )
    await Bun.write(
      join(rootDir, 'references', 'example.md'),
      `# Deep Example

This section describes a concrete pattern.
`,
    )

    const surface = await buildSkillEncodingSurface(join(rootDir, 'SKILL.md'))

    expect(surface.documents.length).toBe(4)
    expect(surface.edges.length).toBe(3)
    expect(surface.edges.some((edge) => edge.type === 'setupFor')).toBe(true)
    expect(surface.edges.some((edge) => edge.type === 'references')).toBe(true)

    const rootDoc = surface.documents.find((doc) => doc.path === join(rootDir, 'SKILL.md'))
    expect(rootDoc).toBeDefined()
    expect(rootDoc!.metadata).toEqual({
      name: 'fixture-skill',
      description: 'Fixture description',
    })
    expect(rootDoc!.sections.some((section) => section.kind === 'purpose')).toBe(true)
    expect(rootDoc!.sections.some((section) => section.text.includes('name: fixture-skill'))).toBe(false)
    expect(rootDoc!.sections.some((section) => section.xml.startsWith('<section '))).toBe(true)
  })
})
