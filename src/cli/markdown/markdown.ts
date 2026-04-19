import { normalize } from 'node:path'
import { YAML } from 'bun'
import * as z from 'zod'
import { makeCli } from '../utils/cli.ts'

type ParsedFrontmatterBlock = {
  frontmatter: string
  bodyStartIndex: number
}

const isLineBreakCharacter = (character: string | undefined): boolean => character === '\n' || character === '\r'

const isWhitespaceCharacter = (character: string): boolean => {
  const charCode = character.charCodeAt(0)
  if (
    charCode === 0x20 ||
    charCode === 0x09 ||
    charCode === 0x0a ||
    charCode === 0x0b ||
    charCode === 0x0c ||
    charCode === 0x0d
  ) {
    return true
  }

  return character.trim().length === 0
}

const isWhitespaceAt = (value: string, index: number): boolean => {
  const character = value[index]
  return character !== undefined && isWhitespaceCharacter(character)
}

const parseFrontmatterBlock = (markdown: string): ParsedFrontmatterBlock | null => {
  if (!markdown.startsWith('---')) return null

  let openingDelimiterScanIndex = 3
  let lastOpeningLineBreakIndex = -1
  while (openingDelimiterScanIndex < markdown.length && isWhitespaceAt(markdown, openingDelimiterScanIndex)) {
    if (isLineBreakCharacter(markdown[openingDelimiterScanIndex])) {
      lastOpeningLineBreakIndex = openingDelimiterScanIndex
    }
    openingDelimiterScanIndex += 1
  }

  if (lastOpeningLineBreakIndex === -1) {
    return null
  }

  const frontmatterStartIndex = lastOpeningLineBreakIndex + 1
  let frontmatterEndIndex = -1

  for (let index = frontmatterStartIndex; index < markdown.length - 3; index++) {
    if (!isLineBreakCharacter(markdown[index])) continue
    if (!markdown.startsWith('---', index + 1)) continue
    frontmatterEndIndex = index
    break
  }

  if (frontmatterEndIndex === -1) return null

  let bodyStartIndex = frontmatterEndIndex + 4
  while (bodyStartIndex < markdown.length && isWhitespaceAt(markdown, bodyStartIndex)) {
    bodyStartIndex += 1
  }

  return {
    frontmatter: markdown.slice(frontmatterStartIndex, frontmatterEndIndex),
    bodyStartIndex,
  }
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
  const parsedFrontmatterBlock = parseFrontmatterBlock(markdown)
  const frontmatter = parsedFrontmatterBlock?.frontmatter
  if (!frontmatter) {
    throw new Error('Missing YAML frontmatter')
  }

  const body = markdown.slice(parsedFrontmatterBlock.bodyStartIndex).trim()
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
 * Local markdown link with its normalized target and display text.
 *
 * @public
 */
export type LocalMarkdownLink = {
  value: string
  text: string
}

const MarkdownLinksFromPathInputSchema = z
  .object({
    path: z.string().min(1),
  })
  .strict()

const MarkdownLinksFromTextInputSchema = z
  .object({
    markdown: z.string().min(1),
  })
  .strict()

export const MarkdownLinksInputSchema = z.union([MarkdownLinksFromPathInputSchema, MarkdownLinksFromTextInputSchema])

/** @public */
export type MarkdownLinksInput = z.infer<typeof MarkdownLinksInputSchema>

export const MarkdownLinksOutputSchema = z.array(
  z.object({
    value: z.string().min(1),
    text: z.string().min(1),
  }),
)

/** @public */
export type MarkdownLinksOutput = z.infer<typeof MarkdownLinksOutputSchema>

const extractMarkdownLinkDestination = (value: string): string => {
  const trimmedValue = value.trim()
  if (!trimmedValue) return trimmedValue

  if (trimmedValue.startsWith('<')) {
    const closingBracketIndex = trimmedValue.indexOf('>')
    if (closingBracketIndex > 0) {
      return trimmedValue.slice(1, closingBracketIndex)
    }
  }

  const firstWhitespaceIndex = trimmedValue.search(/\s/)
  if (firstWhitespaceIndex === -1) return trimmedValue
  return trimmedValue.slice(0, firstWhitespaceIndex)
}

const stripHtmlTags = (value: string): string => {
  const textParts: string[] = []
  let pendingTag: string[] | null = null

  for (const character of value) {
    if (pendingTag) {
      pendingTag.push(character)
      if (character === '>') {
        pendingTag = null
      }
      continue
    }

    if (character === '<') {
      pendingTag = ['<']
      continue
    }

    textParts.push(character)
  }

  if (pendingTag) {
    textParts.push(...pendingTag)
  }

  return textParts.join('')
}

const setLinkTextIfMissing = ({
  linkTextByTarget,
  target,
  text,
}: {
  linkTextByTarget: Map<string, string>
  target: string | null
  text: string
}): void => {
  if (!target || linkTextByTarget.has(target)) return
  linkTextByTarget.set(target, text.trim() || target)
}

type InlineMarkdownLink = {
  text: string
  destination: string
}

const isEscapedCharacter = (value: string, index: number): boolean => {
  let slashCount = 0
  for (let currentIndex = index - 1; currentIndex >= 0 && value[currentIndex] === '\\'; currentIndex -= 1) {
    slashCount += 1
  }
  return slashCount % 2 === 1
}

const findInlineDestinationEnd = (value: string, startIndex: number): number => {
  for (let index = startIndex; index < value.length; index += 1) {
    if (value[index] !== ')' || isEscapedCharacter(value, index)) continue
    return index
  }
  return -1
}

const extractInlineMarkdownLinks = (markdownBody: string): InlineMarkdownLink[] => {
  const links: InlineMarkdownLink[] = []

  for (let index = 0; index < markdownBody.length; index += 1) {
    const character = markdownBody[index]
    if (character === undefined) continue

    const startsImageLink =
      character === '!' && markdownBody[index + 1] === '[' && !isEscapedCharacter(markdownBody, index)
    const startsTextLink = character === '[' && !isEscapedCharacter(markdownBody, index)
    if (!startsImageLink && !startsTextLink) continue

    const openBracketIndex = startsImageLink ? index + 1 : index
    let scanIndex = openBracketIndex + 1
    let bracketDepth = 1
    let closeBracketIndex = -1

    while (scanIndex < markdownBody.length) {
      const scanCharacter = markdownBody[scanIndex]
      if (scanCharacter === undefined) break

      if (scanCharacter === '[' && !isEscapedCharacter(markdownBody, scanIndex)) {
        bracketDepth += 1
      } else if (scanCharacter === ']' && !isEscapedCharacter(markdownBody, scanIndex)) {
        bracketDepth -= 1
        if (bracketDepth === 0) {
          closeBracketIndex = scanIndex
          break
        }
      }

      scanIndex += 1
    }

    if (closeBracketIndex === -1) {
      index = openBracketIndex
      continue
    }

    const openParenIndex = closeBracketIndex + 1
    if (markdownBody[openParenIndex] !== '(') {
      index = closeBracketIndex
      continue
    }

    const destinationStartIndex = openParenIndex + 1
    const destinationEndIndex = findInlineDestinationEnd(markdownBody, destinationStartIndex)
    if (destinationEndIndex === -1) {
      break
    }

    const destination = markdownBody.slice(destinationStartIndex, destinationEndIndex)
    if (destination.trim().length > 0) {
      links.push({
        text: markdownBody.slice(openBracketIndex + 1, closeBracketIndex),
        destination,
      })
    }

    index = destinationEndIndex
  }

  return links
}

const extractLocalLinkTextByTarget = (markdownBody: string): Map<string, string> => {
  const linkTextByTarget = new Map<string, string>()
  const htmlAnchorPattern = /<a\b[^>]*\bhref=(['"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi
  const htmlImagePattern = /<img\b[^>]*>/gi

  for (const link of extractInlineMarkdownLinks(markdownBody)) {
    const text = link.text
    const destination = link.destination
    const normalizedTarget = normalizeMarkdownLink(extractMarkdownLinkDestination(destination))
    setLinkTextIfMissing({
      linkTextByTarget,
      target: normalizedTarget,
      text,
    })
  }

  for (const match of markdownBody.matchAll(htmlAnchorPattern)) {
    const destination = match[2] ?? ''
    const text = stripHtmlTags(match[3] ?? '')
    const normalizedTarget = normalizeMarkdownLink(destination)
    setLinkTextIfMissing({
      linkTextByTarget,
      target: normalizedTarget,
      text,
    })
  }

  for (const match of markdownBody.matchAll(htmlImagePattern)) {
    const imageTag = match[0] ?? ''
    const sourceMatch = imageTag.match(/\bsrc=(['"])(.*?)\1/i)
    const altMatch = imageTag.match(/\balt=(['"])(.*?)\1/i)
    const source = sourceMatch?.[2]
    const text = altMatch?.[2] ?? ''
    const normalizedTarget = source ? normalizeMarkdownLink(source) : null
    setLinkTextIfMissing({
      linkTextByTarget,
      target: normalizedTarget,
      text,
    })
  }

  return linkTextByTarget
}

/**
 * Extracts normalized local links from a markdown document body.
 *
 * @param markdownBody - Markdown body to inspect.
 * @returns Sorted list of unique local link targets with display text.
 *
 * @public
 */
export const extractLocalLinksFromMarkdown = async (markdownBody: string): Promise<LocalMarkdownLink[]> => {
  const links = new Set<string>()
  const html = Bun.markdown.html(markdownBody)
  const rewriter = new HTMLRewriter()
  const linkTextByTarget = extractLocalLinkTextByTarget(markdownBody)

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
  return [...links].sort().map((value) => ({
    value,
    text: linkTextByTarget.get(value) ?? value,
  }))
}

const readMarkdownLinksSource = async (input: MarkdownLinksInput): Promise<string> => {
  if ('markdown' in input) return input.markdown

  const file = Bun.file(input.path)
  if (!(await file.exists())) {
    throw new Error(`Markdown file not found: ${input.path}`)
  }
  return file.text()
}

/**
 * Extracts local markdown links from either file path or raw markdown text.
 *
 * @public
 */
export const markdownLinks = async (input: MarkdownLinksInput): Promise<MarkdownLinksOutput> => {
  const markdown = await readMarkdownLinksSource(input)
  return extractLocalLinksFromMarkdown(markdown)
}

/**
 * CLI handler for `markdown-links`.
 *
 * @public
 */
export const markdownLinksCli = makeCli({
  name: 'markdown-links',
  inputSchema: MarkdownLinksInputSchema,
  outputSchema: MarkdownLinksOutputSchema,
  run: markdownLinks,
})
