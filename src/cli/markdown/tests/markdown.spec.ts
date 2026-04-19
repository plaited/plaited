import { describe, expect, test } from 'bun:test'
import { Blob } from 'node:buffer'
import { join, resolve } from 'node:path'
import * as z from 'zod'
import {
  consumeHtmlRewriteResult,
  extractLocalLinksFromMarkdown,
  extractMarkdownSection,
  markdownLinks,
  normalizeMarkdownLink,
  parseMarkdownWithFrontmatter,
} from '../markdown.ts'

const CLI_PACKAGE_ROOT = resolve(import.meta.dir, '../../../../')

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

  test('preserves leading indentation after opening delimiter before YAML parsing', () => {
    expect(() =>
      parseMarkdownWithFrontmatter(
        `---
 name: test-skill
description: A test skill
---
Body content.
`,
        TestFrontmatterSchema,
      ),
    ).toThrow('YAML Parse error')
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

    expect(links).toEqual([
      { value: 'assets/diagram.png', text: 'diagram' },
      { value: 'references/setup.md', text: 'setup' },
      { value: 'scripts/setup.ts', text: 'script' },
    ])
  })

  test('deduplicates and sorts extracted links, defaulting text to the link value', async () => {
    const links = await extractLocalLinksFromMarkdown(`
[b](scripts/b.ts)
[a](scripts/a.ts)
![b](scripts/b.ts)
[](<scripts/c.ts>)
`)

    expect(links).toEqual([
      { value: 'scripts/a.ts', text: 'a' },
      { value: 'scripts/b.ts', text: 'b' },
      { value: 'scripts/c.ts', text: 'scripts/c.ts' },
    ])
  })

  test('handles html anchor text with repeated unmatched angle brackets', async () => {
    const angleText = '<'.repeat(2_000)
    const links = await extractLocalLinksFromMarkdown(`<a href="scripts/run.ts">${angleText}</a>`)

    expect(links).toEqual([{ value: 'scripts/run.ts', text: angleText }])
  })

  test('does not hang on CodeQL reported markdown-inline-link shapes', async () => {
    const timeoutMs = 2_000
    const raceWithTimeout = async (markdown: string): Promise<void> => {
      const links = await Promise.race([
        extractLocalLinksFromMarkdown(markdown),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('extractLocalLinksFromMarkdown timed out')), timeoutMs),
        ),
      ])
      expect(Array.isArray(links)).toBeTrue()
    }

    const inputs = ['['.repeat(4_000), '[\\'.repeat(2_000), `[](${'x'.repeat(4_000)}`, '[](('.repeat(2_000)]

    for (const input of inputs) {
      await raceWithTimeout(input)
    }
  })
})

describe('markdownLinks', () => {
  test('extracts links from a markdown file path', async () => {
    const tempPath = join('/tmp', `plaited-markdown-links-${Date.now()}.md`)
    await Bun.write(tempPath, '[setup](references/setup.md)\n![diagram](assets/diagram.png)')

    const links = await markdownLinks({ path: tempPath })

    expect(links).toEqual([
      { value: 'assets/diagram.png', text: 'diagram' },
      { value: 'references/setup.md', text: 'setup' },
    ])

    await Bun.$`rm -f ${tempPath}`
  })

  test('extracts links from raw markdown input', async () => {
    const links = await markdownLinks({ markdown: '[script](scripts/run.ts#main)' })

    expect(links).toEqual([{ value: 'scripts/run.ts', text: 'script' }])
  })

  test('throws when the source file does not exist', async () => {
    const missingPath = join('/tmp', `plaited-markdown-links-missing-${Date.now()}.md`)
    await expect(markdownLinks({ path: missingPath })).rejects.toThrow(`Markdown file not found: ${missingPath}`)
  })

  test('markdown-links CLI handler outputs JSON links', async () => {
    const script = "import { markdownLinksCli } from './src/cli.ts'; await markdownLinksCli(process.argv.slice(1));"
    const input = JSON.stringify({ markdown: '[setup](references/setup.md)' })
    const result = await Bun.$`bun -e ${script} -- ${input}`.cwd(CLI_PACKAGE_ROOT).nothrow()

    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout.toString().trim())).toEqual([{ value: 'references/setup.md', text: 'setup' }])
  })

  test('markdown-links CLI handler exits with invalid input', async () => {
    const script = "import { markdownLinksCli } from './src/cli.ts'; await markdownLinksCli(process.argv.slice(1));"
    const input = JSON.stringify({})
    const result = await Bun.$`bun -e ${script} -- ${input}`.cwd(CLI_PACKAGE_ROOT).nothrow()

    expect(result.exitCode).toBe(2)
    expect(result.stderr.toString()).toContain('invalid_union')
  })

  test('markdown-links CLI handler rejects input containing both path and markdown', async () => {
    const script = "import { markdownLinksCli } from './src/cli.ts'; await markdownLinksCli(process.argv.slice(1));"
    const input = JSON.stringify({
      path: 'skills/typescript-lsp/SKILL.md',
      markdown: '[x](y.md)',
    })
    const result = await Bun.$`bun -e ${script} -- ${input}`.cwd(CLI_PACKAGE_ROOT).nothrow()

    expect(result.exitCode).toBe(2)
    expect(result.stderr.toString()).toContain('invalid_union')
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
