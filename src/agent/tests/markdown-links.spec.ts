import { describe, expect, test } from 'bun:test'
import { extractMarkdownLinks, getExtension, isExternalLink } from '../markdown-links.ts'

// ============================================================================
// extractMarkdownLinks Tests
// ============================================================================

describe('extractMarkdownLinks', () => {
  test('extracts single link', () => {
    const content = 'See [the guide](references/guide.md) for details.'
    const links = extractMarkdownLinks(content)

    expect(links).toHaveLength(1)
    expect(links[0]).toEqual({
      displayText: 'the guide',
      relativePath: 'references/guide.md',
      lineNumber: 1,
    })
  })

  test('extracts multiple links on same line', () => {
    const content = 'Check [docs](docs.md) and [api](api.md) for more.'
    const links = extractMarkdownLinks(content)

    expect(links).toHaveLength(2)
    expect(links[0]!.displayText).toBe('docs')
    expect(links[1]!.displayText).toBe('api')
  })

  test('extracts links across multiple lines', () => {
    const content = `# Header

See [first](first.md) for intro.

Then read [second](second.md) for details.`

    const links = extractMarkdownLinks(content)

    expect(links).toHaveLength(2)
    expect(links[0]).toEqual({
      displayText: 'first',
      relativePath: 'first.md',
      lineNumber: 3,
    })
    expect(links[1]).toEqual({
      displayText: 'second',
      relativePath: 'second.md',
      lineNumber: 5,
    })
  })

  test('excludes image links', () => {
    const content = `
![image](image.png)
[link](link.md)
![another](another.jpg)
`
    const links = extractMarkdownLinks(content)

    expect(links).toHaveLength(1)
    expect(links[0]!.displayText).toBe('link')
  })

  test('excludes external links by default', () => {
    const content = `
[local](local.md)
[google](https://google.com)
[example](http://example.com)
`
    const links = extractMarkdownLinks(content)

    expect(links).toHaveLength(1)
    expect(links[0]!.relativePath).toBe('local.md')
  })

  test('includes external links when option set', () => {
    const content = `
[local](local.md)
[google](https://google.com)
`
    const links = extractMarkdownLinks(content, { includeExternal: true })

    expect(links).toHaveLength(2)
    expect(links[1]!.relativePath).toBe('https://google.com')
  })

  test('filters by path pattern', () => {
    const content = `
[a](references/a.md)
[b](scripts/b.ts)
[c](references/c.md)
`
    const links = extractMarkdownLinks(content, { pathPattern: /^references\// })

    expect(links).toHaveLength(2)
    expect(links[0]!.relativePath).toBe('references/a.md')
    expect(links[1]!.relativePath).toBe('references/c.md')
  })

  test('filters by extensions', () => {
    const content = `
[readme](README.md)
[script](run.ts)
[config](config.json)
[style](style.css)
`
    const links = extractMarkdownLinks(content, { extensions: ['.md', '.ts'] })

    expect(links).toHaveLength(2)
    expect(links[0]!.relativePath).toBe('README.md')
    expect(links[1]!.relativePath).toBe('run.ts')
  })

  test('handles nested paths', () => {
    const content = '[deep](a/b/c/deep.md)'
    const links = extractMarkdownLinks(content)

    expect(links).toHaveLength(1)
    expect(links[0]!.relativePath).toBe('a/b/c/deep.md')
  })

  test('handles relative parent paths', () => {
    const content = '[parent](../parent.md)'
    const links = extractMarkdownLinks(content)

    expect(links).toHaveLength(1)
    expect(links[0]!.relativePath).toBe('../parent.md')
  })

  test('handles current directory paths', () => {
    const content = '[current](./current.md)'
    const links = extractMarkdownLinks(content)

    expect(links).toHaveLength(1)
    expect(links[0]!.relativePath).toBe('./current.md')
  })

  test('returns empty array for no links', () => {
    const content = 'No links here, just text.'
    const links = extractMarkdownLinks(content)

    expect(links).toHaveLength(0)
  })

  test('returns empty array for empty content', () => {
    const links = extractMarkdownLinks('')

    expect(links).toHaveLength(0)
  })

  test('handles display text with special characters', () => {
    const content = '[code `example`](example.md)'
    const links = extractMarkdownLinks(content)

    expect(links).toHaveLength(1)
    expect(links[0]!.displayText).toBe('code `example`')
  })

  test('handles paths with query strings', () => {
    const content = '[doc](doc.md#section)'
    const links = extractMarkdownLinks(content)

    expect(links).toHaveLength(1)
    expect(links[0]!.relativePath).toBe('doc.md#section')
  })
})

// ============================================================================
// isExternalLink Tests
// ============================================================================

describe('isExternalLink', () => {
  test('returns true for https URLs', () => {
    expect(isExternalLink('https://example.com')).toBe(true)
    expect(isExternalLink('https://example.com/path')).toBe(true)
  })

  test('returns true for http URLs', () => {
    expect(isExternalLink('http://example.com')).toBe(true)
  })

  test('returns false for relative paths', () => {
    expect(isExternalLink('relative/path.md')).toBe(false)
    expect(isExternalLink('./current.md')).toBe(false)
    expect(isExternalLink('../parent.md')).toBe(false)
  })

  test('returns false for absolute paths', () => {
    expect(isExternalLink('/absolute/path.md')).toBe(false)
  })
})

// ============================================================================
// getExtension Tests
// ============================================================================

describe('getExtension', () => {
  test('extracts common extensions', () => {
    expect(getExtension('file.md')).toBe('.md')
    expect(getExtension('script.ts')).toBe('.ts')
    expect(getExtension('config.json')).toBe('.json')
  })

  test('handles nested paths', () => {
    expect(getExtension('a/b/c/file.md')).toBe('.md')
  })

  test('returns empty for no extension', () => {
    expect(getExtension('README')).toBe('')
    expect(getExtension('Makefile')).toBe('')
  })

  test('handles multiple dots', () => {
    expect(getExtension('file.spec.ts')).toBe('.ts')
    expect(getExtension('archive.tar.gz')).toBe('.gz')
  })

  test('handles dot in directory name', () => {
    expect(getExtension('.claude/skills/file')).toBe('')
    expect(getExtension('.claude/skills/file.md')).toBe('.md')
  })

  test('handles Windows-style paths', () => {
    expect(getExtension('a\\b\\file.md')).toBe('.md')
  })
})
