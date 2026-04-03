import { normalize } from 'node:path'
import { YAML } from 'bun'
import type * as z from 'zod'

const frontmatterRegex = /^---\s*[\r\n]([\s\S]*?)[\r\n]---\s*/

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

export const parseMarkdownWithFrontmatter = <TSchema extends z.ZodType>(
  markdown: string,
  schema: TSchema,
  options?: {
    requireBody?: boolean
  },
): { frontmatter: z.infer<TSchema>; body: string } => {
  const match = markdown.match(frontmatterRegex)
  const frontmatter = match?.[1]
  if (!frontmatter) {
    throw new Error('Missing YAML frontmatter')
  }

  const body = markdown.slice(match[0].length).trim()
  if (options?.requireBody !== false && !body) {
    throw new Error('Markdown body must not be empty')
  }

  const data = YAML.parse(frontmatter)
  return {
    frontmatter: schema.parse(data),
    body,
  }
}

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
