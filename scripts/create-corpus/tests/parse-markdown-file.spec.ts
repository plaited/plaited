import { expect, test, describe } from 'bun:test'
import { parseMarkdownFile } from '../parse-markdown-file.js'

describe('Markdown Parser', () => {
  test('should return object with expected properties', async () => {
    const markdown = '# Test'
    const result = await parseMarkdownFile(markdown)

    // Test output object structure
    expect(result).toHaveProperty('ast')
    expect(result).toHaveProperty('links')
    expect(result).toHaveProperty('source')
    expect(result).toHaveProperty('embeddings')
    expect(result.source).toBe(markdown)
  })
  test('should extract links from markdown content', async () => {
    const markdown = `
# Test Document

Here's a [link to example](https://example.com)
And another [duplicate link](https://example.com)
And a [different link](https://different.com)

[Link with title](https://titled.com "Title")
    `

    const result = await parseMarkdownFile(markdown)

    // Test that links array exists and contains expected URLs
    expect(result.links).toBeDefined()
    expect(Array.isArray(result.links)).toBe(true)

    // Test for expected URLs
    expect(result.links).toContain('https://example.com')
    expect(result.links).toContain('https://different.com')
    expect(result.links).toContain('https://titled.com')

    // Test that duplicate URLs are removed
    expect(result.links.filter((url) => url === 'https://example.com').length).toBe(1)

    // Test total number of unique links
    expect(result.links.length).toBe(3)
  })

  test('should handle markdown with no links', async () => {
    const markdown = `
# Test Document

This is a test document with no links.
Just plain text and *some formatting*.
    `

    const result = await parseMarkdownFile(markdown)

    expect(result.links).toBeDefined()
    expect(result.links).toEqual([])
  })

  test('should return AST object', async () => {
    const markdown = '# Test'
    const result = await parseMarkdownFile(markdown)

    expect(result.ast).toBeDefined()
    expect(typeof result.ast).toBe('object')
  })
})
