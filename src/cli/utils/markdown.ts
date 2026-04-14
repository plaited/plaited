import { normalize } from 'node:path'
import { YAML } from 'bun'
import type * as z from 'zod'

type ParsedFrontmatterBlock = {
  frontmatter: string
  bodyStartIndex: number
}

const isFrontmatterDelimiterLine = (line: string): boolean => {
  if (!line.startsWith('---')) return false
  for (let index = 3; index < line.length; index++) {
    const charCode = line.charCodeAt(index)
    if (charCode !== 0x20 && charCode !== 0x09) return false
  }
  return true
}

const findLineEnd = (value: string, startIndex: number): number => {
  for (let index = startIndex; index < value.length; index++) {
    const charCode = value.charCodeAt(index)
    if (charCode === 0x0a || charCode === 0x0d) return index
  }
  return -1
}

const skipLineBreak = (value: string, lineEndIndex: number): number => {
  const charCode = value.charCodeAt(lineEndIndex)
  if (charCode === 0x0d && value.charCodeAt(lineEndIndex + 1) === 0x0a) return lineEndIndex + 2
  return lineEndIndex + 1
}

const trimTrailingLineBreak = (value: string): string => {
  if (value.endsWith('\r\n')) return value.slice(0, -2)
  if (value.endsWith('\n') || value.endsWith('\r')) return value.slice(0, -1)
  return value
}

const parseFrontmatterBlock = (markdown: string): ParsedFrontmatterBlock | null => {
  const openingLineEnd = findLineEnd(markdown, 0)
  if (openingLineEnd === -1) return null

  const openingLine = markdown.slice(0, openingLineEnd)
  if (!isFrontmatterDelimiterLine(openingLine)) return null

  const frontmatterStartIndex = skipLineBreak(markdown, openingLineEnd)
  let lineStartIndex = frontmatterStartIndex

  while (lineStartIndex < markdown.length) {
    const lineEndIndex = findLineEnd(markdown, lineStartIndex)
    const line = markdown.slice(lineStartIndex, lineEndIndex === -1 ? markdown.length : lineEndIndex)
    if (isFrontmatterDelimiterLine(line)) {
      const frontmatterWithTrailingLineBreak = markdown.slice(frontmatterStartIndex, lineStartIndex)
      const bodyStartIndex = lineEndIndex === -1 ? markdown.length : skipLineBreak(markdown, lineEndIndex)
      return {
        frontmatter: trimTrailingLineBreak(frontmatterWithTrailingLineBreak),
        bodyStartIndex,
      }
    }

    if (lineEndIndex === -1) return null
    lineStartIndex = skipLineBreak(markdown, lineEndIndex)
  }

  return null
}

/**
 * Consumes an `HTMLRewriter` result so link extraction side effects are applied.
 *
 * @param result - Rewriter output in any supported body format.
 * @returns Promise that resolves after the transformed body has been fully consumed.
 *
 * @public
 */
export const consumeHtmlRewriteResult = async (result: string | Response | Blob | ArrayBufferLike): Promise<void> => {
  if (typeof result === 'string') return
  if (result instanceof Response) {
    await result.text()
    return
  }
  if (result instanceof Blob) {
    await result.text()
    return
  }
  void new TextDecoder().decode(new Uint8Array(result))
}

/**
 * Parses YAML frontmatter from a markdown document and validates it with Zod.
 *
 * @template TSchema - Schema used to validate the frontmatter object.
 * @param markdown - Markdown source containing YAML frontmatter.
 * @param schema - Zod schema used to parse the frontmatter block.
 * @param options - Optional parsing controls.
 * @returns Parsed frontmatter plus the remaining markdown body.
 *
 * @public
 */
export const parseMarkdownWithFrontmatter = <TSchema extends z.ZodType>(
  markdown: string,
  schema: TSchema,
  options?: {
    requireBody?: boolean
  },
): { frontmatter: z.infer<TSchema>; body: string } => {
  const parsedBlock = parseFrontmatterBlock(markdown)
  const frontmatter = parsedBlock?.frontmatter
  if (!frontmatter) {
    throw new Error('Missing YAML frontmatter')
  }

  const body = markdown.slice(parsedBlock.bodyStartIndex).trim()
  if (options?.requireBody !== false && !body) {
    throw new Error('Markdown body must not be empty')
  }

  const data = YAML.parse(frontmatter)
  return {
    frontmatter: schema.parse(data),
    body,
  }
}

/**
 * Extracts the body of the first matching level-two markdown section.
 *
 * @param markdown - Full markdown source to scan.
 * @param headings - Accepted section headings without the `##` prefix.
 * @returns Trimmed section body, or `null` when no matching section exists.
 *
 * @public
 */
export const extractMarkdownSection = (markdown: string, headings: string[]): string | null => {
  const lines = markdown.split(/\r?\n/)
  const escapedHeadings = headings.map((heading) => heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const headingPattern = new RegExp(`^## (?:${escapedHeadings.join('|')})\\s*$`)
  const nextHeadingPattern = /^##\s+/
  const startIndex = lines.findIndex((line) => headingPattern.test(line.trim()))

  if (startIndex === -1) return null

  const sectionLines: string[] = []
  for (let index = startIndex + 1; index < lines.length; index++) {
    const line = lines[index]
    if (line !== undefined && nextHeadingPattern.test(line.trim())) break
    sectionLines.push(line ?? '')
  }

  const section = sectionLines.join('\n').trim()
  return section.length > 0 ? section : null
}

/**
 * Normalizes a markdown link target when it points to a local workspace path.
 *
 * @param value - Raw markdown link target.
 * @returns Normalized local path, or `null` for external and fragment-only links.
 *
 * @public
 */
export const normalizeMarkdownLink = (value: string): string | null => {
  if (
    !value ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('mailto:') ||
    value.startsWith('#')
  ) {
    return null
  }

  const [path] = value.split('#')
  if (!path) return null
  return normalize(path)
}

/**
 * Extracts normalized local links from a markdown document body.
 *
 * @param markdownBody - Markdown body to inspect.
 * @returns Sorted list of unique local link targets referenced by anchors or images.
 *
 * @public
 */
export const extractLocalLinksFromMarkdown = async (markdownBody: string): Promise<string[]> => {
  const links = new Set<string>()
  const html = Bun.markdown.html(markdownBody)
  const rewriter = new HTMLRewriter()

  for (const selector of ['a', 'img']) {
    rewriter.on(selector, {
      element(element) {
        const attribute = selector === 'a' ? 'href' : 'src'
        const value = element.getAttribute(attribute)
        const normalizedLink = value ? normalizeMarkdownLink(value) : null
        if (normalizedLink) {
          links.add(normalizedLink)
        }
      },
    })
  }

  await consumeHtmlRewriteResult(rewriter.transform(html))
  return [...links].sort()
}
