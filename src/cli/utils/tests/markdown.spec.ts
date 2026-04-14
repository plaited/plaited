import { describe, expect, test } from 'bun:test'
import { Blob } from 'node:buffer'
import * as z from 'zod'
import {
  consumeHtmlRewriteResult,
  extractLocalLinksFromMarkdown,
  extractMarkdownSection,
  normalizeMarkdownLink,
  parseMarkdownWithFrontmatter,
} from '../markdown.ts'

const TestFrontmatterSchema = z.object({
  name: z.string(),
  description: z.string(),
  metadata: z.record(z.string(), z.string()).optional(),
})

describe('parseMarkdownWithFrontmatter', () => {
  test('parses frontmatter and body', () => {
    const parsed = parseMarkdownWithFrontmatter(
      `---
name: test-skill
description: A test skill
metadata:
  owner: docs
---

# Heading

Body content.
`,
      TestFrontmatterSchema,
    )

    expect(parsed.frontmatter).toEqual({
      name: 'test-skill',
      description: 'A test skill',
      metadata: { owner: 'docs' },
    })
    expect(parsed.body).toContain('# Heading')
    expect(parsed.body).toContain('Body content.')
  })

  test('allows an empty body when requireBody is false', () => {
    const parsed = parseMarkdownWithFrontmatter(
      `---
name: test-skill
description: A test skill
---`,
      TestFrontmatterSchema,
      { requireBody: false },
    )

    expect(parsed.body).toBe('')
  })

  test('preserves legacy parsing when closing delimiter is followed by body text on the same line', () => {
    const parsed = parseMarkdownWithFrontmatter(
      `---
name: test-skill
description: A test skill
---# Heading

Body content.
`,
      TestFrontmatterSchema,
    )

    expect(parsed.body).toBe('# Heading\n\nBody content.')
  })

  test('throws when frontmatter is missing', () => {
    expect(() => parseMarkdownWithFrontmatter('# No frontmatter', TestFrontmatterSchema)).toThrow(
      'Missing YAML frontmatter',
    )
  })

  test('throws when the body is required but empty', () => {
    expect(() =>
      parseMarkdownWithFrontmatter(
        `---
name: test-skill
description: A test skill
---`,
        TestFrontmatterSchema,
      ),
    ).toThrow('Markdown body must not be empty')
  })

  test('throws on large malformed near-delimiter input without hanging', () => {
    const repeatedNearDelimiterWhitespace = '\n '.repeat(20_000)
    const markdown = `---${repeatedNearDelimiterWhitespace}`

    expect(() => parseMarkdownWithFrontmatter(markdown, TestFrontmatterSchema)).toThrow('Missing YAML frontmatter')
  })
})

describe('normalizeMarkdownLink', () => {
  test('normalizes local relative paths', () => {
    expect(normalizeMarkdownLink('references/../scripts/setup.ts')).toBe('scripts/setup.ts')
  })

  test('strips fragment identifiers', () => {
    expect(normalizeMarkdownLink('references/setup.md#install')).toBe('references/setup.md')
  })

  test('returns null for external or anchor-only links', () => {
    expect(normalizeMarkdownLink('https://example.com')).toBeNull()
    expect(normalizeMarkdownLink('mailto:test@example.com')).toBeNull()
    expect(normalizeMarkdownLink('#top')).toBeNull()
  })
})

describe('extractLocalLinksFromMarkdown', () => {
  test('extracts local links from anchors and images', async () => {
    const links = await extractLocalLinksFromMarkdown(`
# Skill

See [setup](references/setup.md), [script](scripts/setup.ts#run), and ![diagram](assets/diagram.png).
Ignore [docs](https://example.com), [anchor](#top), and <img src="https://example.com/remote.png" />.
`)

    expect(links).toEqual(['assets/diagram.png', 'references/setup.md', 'scripts/setup.ts'])
  })

  test('deduplicates and sorts extracted links', async () => {
    const links = await extractLocalLinksFromMarkdown(`
[b](scripts/b.ts)
[a](scripts/a.ts)
![b](scripts/b.ts)
`)

    expect(links).toEqual(['scripts/a.ts', 'scripts/b.ts'])
  })
})

describe('extractMarkdownSection', () => {
  test('returns the requested heading body', () => {
    const section = extractMarkdownSection(
      `# Program

## Mission

Ship it.

## Writable Roots

- [agent](../../src/agent/)

## Validation

- Run tests.
`,
      ['Writable Roots'],
    )

    expect(section).toBe('- [agent](../../src/agent/)')
  })

  test('returns null when the heading is absent', () => {
    expect(extractMarkdownSection('# Program\n\n## Mission\n\nShip it.\n', ['Scope'])).toBeNull()
  })
})

describe('consumeHtmlRewriteResult', () => {
  test('accepts a plain string result', async () => {
    await expect(consumeHtmlRewriteResult('<p>ok</p>')).resolves.toBeUndefined()
  })

  test('accepts a Response result', async () => {
    await expect(consumeHtmlRewriteResult(new Response('<p>ok</p>'))).resolves.toBeUndefined()
  })

  test('accepts a Blob result', async () => {
    await expect(consumeHtmlRewriteResult(new Blob(['<p>ok</p>']))).resolves.toBeUndefined()
  })
})
