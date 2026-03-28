import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildDocChunks, loadDocChunkFile } from '../mss-doc-chunks.ts'

describe('mss-doc-chunks', () => {
  test('loads sections and links from a markdown document', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mss-doc-chunks-'))
    const targetPath = join(root, 'sample.md')
    const linkedPath = join(root, 'linked.md')

    await Bun.write(linkedPath, '# Linked\n\nReference target.\n')
    await Bun.write(
      targetPath,
      `---
title: Sample
---

# Purpose

Top level overview with a [reference](./linked.md).

## Pattern One

Pattern detail.
`,
    )

    const chunkFile = await loadDocChunkFile(targetPath)

    expect(chunkFile).not.toBeNull()
    expect(chunkFile?.sections.length).toBe(2)
    expect(chunkFile?.sections[0]?.headingPath).toEqual(['Purpose'])
    expect(chunkFile?.sections[1]?.headingPath).toEqual(['Purpose', 'Pattern One'])
    expect(chunkFile?.links).toHaveLength(1)
    expect(chunkFile?.links[0]?.to).toBe(linkedPath)

    await rm(root, { force: true, recursive: true })
  })

  test('builds chunk files for multiple docs and skips missing inputs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mss-doc-chunks-'))
    const firstPath = join(root, 'first.md')
    const secondPath = join(root, 'second.md')

    await Bun.write(firstPath, '# First\n\nAlpha.\n')
    await Bun.write(secondPath, '# Second\n\nBeta.\n')

    const files = await buildDocChunks([firstPath, join(root, 'missing.md'), secondPath])

    expect(files.map((file) => file.title)).toEqual(['first.md', 'second.md'])
    expect(files[0]?.sections[0]?.heading).toBe('First')
    expect(files[1]?.sections[0]?.heading).toBe('Second')

    await rm(root, { force: true, recursive: true })
  })
})
