/**
 * Skill/doc encoding surface — deterministic markdown sectioning and link extraction.
 *
 * @remarks
 * Uses Bun markdown rendering plus HTMLRewriter for link extraction, then
 * builds a structured section/provenance surface that can be fed to a model
 * or used by deterministic validators.
 *
 * @public
 */

import { basename, dirname, isAbsolute, normalize, resolve } from 'node:path'
import * as z from 'zod'
import { RISK_TAG } from '../agent/agent.constants.ts'
import type { ToolDefinition } from '../agent/agent.schemas.ts'
import type { ToolHandler } from '../agent/agent.types.ts'
import { parseCli } from '../cli/cli.utils.ts'
import { parseFrontmatter } from './skill.utils.ts'

export type SkillLinkEdgeType = 'references' | 'setupFor' | 'examples' | 'dependsOn'

export type SkillLinkEdge = {
  from: string
  to: string
  type: SkillLinkEdgeType
  label: string
  headingPath: string[]
}

export type SkillSection = {
  id: string
  path: string
  kind: 'purpose' | 'pattern' | 'rule' | 'reference' | 'example' | 'notes'
  heading: string
  headingPath: string[]
  text: string
  xml: string
}

export type SkillDocumentSurface = {
  path: string
  title: string
  metadata?: Record<string, unknown>
  sections: SkillSection[]
}

export type SkillEncodingSurface = {
  root: string
  documents: SkillDocumentSurface[]
  edges: SkillLinkEdge[]
}

const SkillLinksInputSchema = z.object({
  path: z.string().describe('Path to SKILL.md or another markdown file'),
})

const SkillSectionSchema = z.object({
  id: z.string(),
  path: z.string(),
  kind: z.enum(['purpose', 'pattern', 'rule', 'reference', 'example', 'notes']),
  heading: z.string(),
  headingPath: z.array(z.string()),
  text: z.string(),
  xml: z.string(),
})

const SkillLinkEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: z.enum(['references', 'setupFor', 'examples', 'dependsOn']),
  label: z.string(),
  headingPath: z.array(z.string()),
})

const SkillLinksOutputSchema = z.object({
  root: z.string(),
  documents: z.array(
    z.object({
      path: z.string(),
      title: z.string(),
      metadata: z.record(z.string(), z.unknown()).optional(),
      sections: z.array(SkillSectionSchema),
    }),
  ),
  edges: z.array(SkillLinkEdgeSchema),
})

export { SkillLinksInputSchema, SkillLinksOutputSchema }

const MARKDOWN_OPTIONS = {
  autolinks: false,
  headings: { ids: true },
  strikethrough: true,
  tables: true,
  tasklists: true,
} as const

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim()

const escapeXml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')

const classifyEdgeType = (headingPath: string[]): SkillLinkEdgeType => {
  const currentHeading = headingPath.at(-1)?.toLowerCase() ?? ''
  const context = headingPath.join(' / ').toLowerCase()
  if (currentHeading.includes('setup')) return 'setupFor'
  if (
    currentHeading.includes('depend') ||
    currentHeading.includes('requirement') ||
    currentHeading.includes('prerequisite')
  ) {
    return 'dependsOn'
  }
  if (currentHeading.includes('reference')) return 'references'
  if (currentHeading.includes('example')) return 'examples'
  if (context.includes('setup')) return 'setupFor'
  if (context.includes('example')) return 'examples'
  return 'references'
}

const classifySectionKind = (headingPath: string[]): SkillSection['kind'] => {
  const currentHeading = headingPath.at(-1)?.toLowerCase() ?? ''
  const context = headingPath.join(' / ').toLowerCase()
  if (currentHeading.includes('purpose')) return 'purpose'
  if (currentHeading.includes('pattern')) return 'pattern'
  if (currentHeading.includes('rule')) return 'rule'
  if (currentHeading.includes('reference')) return 'reference'
  if (currentHeading.includes('example')) return 'example'
  if (context.includes('purpose')) return 'purpose'
  return 'notes'
}

const isLocalMarkdownLink = (href: string) =>
  !href.startsWith('http://') &&
  !href.startsWith('https://') &&
  !href.startsWith('#') &&
  (href.endsWith('.md') || href.includes('.md#'))

const resolveLinkedPath = (fromPath: string, href: string) => {
  const [target] = href.split('#')
  if (!target) return null
  const baseDir = dirname(fromPath)
  return isAbsolute(target) ? normalize(target) : normalize(resolve(baseDir, target))
}

const maybeConsumeTransform = async (result: string | Response | Blob | ArrayBufferLike) => {
  if (typeof result === 'string') return result
  if (result instanceof Response) return await result.text()
  if (result instanceof Blob) return await result.text()
  return new TextDecoder().decode(new Uint8Array(result))
}

const buildSectionXml = ({
  path,
  kind,
  heading,
  headingPath,
  text,
}: {
  path: string
  kind: SkillSection['kind']
  heading: string
  headingPath: string[]
  text: string
}) =>
  `<section path="${escapeXml(path)}" kind="${kind}" heading="${escapeXml(
    heading,
  )}" headingPath="${escapeXml(headingPath.join(' / '))}">${escapeXml(text)}</section>`

const splitFrontmatter = (content: string): { metadata?: Record<string, unknown>; body: string } => {
  const trimmed = content.trimStart()
  if (!trimmed.startsWith('---')) {
    return { body: content }
  }

  try {
    const { metadata, body } = parseFrontmatter(content)
    return { metadata, body }
  } catch {
    return { body: content }
  }
}

export const extractSectionsFromMarkdown = ({ path, content }: { path: string; content: string }): SkillSection[] => {
  const sections: SkillSection[] = []
  const { body } = splitFrontmatter(content)
  const lines = body.split('\n')
  const headingStack: string[] = []
  let currentHeading = basename(path)
  let currentLevel = 0
  let buffer: string[] = []
  let sectionIndex = 0

  const flush = () => {
    const text = normalizeWhitespace(buffer.join('\n'))
    if (!text) return
    const headingPath = currentLevel === 0 ? [currentHeading] : [...headingStack]
    const kind: SkillSection['kind'] = classifySectionKind(headingPath)
    sections.push({
      id: `${normalize(path)}#section-${sectionIndex.toString().padStart(3, '0')}`,
      path: normalize(path),
      kind,
      heading: currentHeading,
      headingPath,
      text,
      xml: buildSectionXml({
        path: normalize(path),
        kind,
        heading: currentHeading,
        headingPath,
        text,
      }),
    })
    sectionIndex += 1
    buffer = []
  }

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch?.[1] && headingMatch[2]) {
      flush()
      const level = headingMatch[1].length
      const heading = normalizeWhitespace(headingMatch[2])
      headingStack[level - 1] = heading
      headingStack.length = level
      currentHeading = heading
      currentLevel = level
      continue
    }
    buffer.push(line)
  }

  flush()
  return sections
}

export const extractSkillLinksFromMarkdown = async ({
  path,
  content,
}: {
  path: string
  content: string
}): Promise<SkillLinkEdge[]> => {
  const edges: SkillLinkEdge[] = []
  const sections = extractSectionsFromMarkdown({ path, content })

  for (const section of sections) {
    const html = Bun.markdown.html(section.text, MARKDOWN_OPTIONS)
    let currentLinkHref: string | null = null
    let currentLinkText = ''

    const finalizeLink = () => {
      const href = currentLinkHref
      if (!href || !isLocalMarkdownLink(href)) return
      const resolved = resolveLinkedPath(path, href)
      if (!resolved) return
      edges.push({
        from: normalize(path),
        to: resolved,
        type: classifyEdgeType(section.headingPath),
        label: normalizeWhitespace(currentLinkText) || basename(resolved),
        headingPath: [...section.headingPath],
      })
    }

    const rewriter = new HTMLRewriter()
    rewriter.on('a', {
      element(element) {
        currentLinkHref = element.getAttribute('href')
        currentLinkText = ''
      },
      text(text) {
        currentLinkText += text.text
        if (text.lastInTextNode) {
          finalizeLink()
          currentLinkHref = null
          currentLinkText = ''
        }
      },
    })

    await maybeConsumeTransform(rewriter.transform(html))
  }

  return edges
}

const readLocalMarkdown = async (path: string) => {
  const file = Bun.file(path)
  if (!(await file.exists())) return null
  return await file.text()
}

const buildDocumentTitle = async (path: string) => {
  const content = await readLocalMarkdown(path)
  if (!content) return basename(path)
  const firstHeading = content
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('# '))
  return firstHeading ? normalizeWhitespace(firstHeading.replace(/^#\s+/, '')) : basename(path)
}

export const buildSkillEncodingSurface = async (rootPath: string): Promise<SkillEncodingSurface> => {
  const queue = [normalize(resolve(rootPath))]
  const visited = new Set<string>()
  const documents: SkillDocumentSurface[] = []
  const edges: SkillLinkEdge[] = []

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || visited.has(current)) continue
    visited.add(current)

    const content = await readLocalMarkdown(current)
    if (!content) continue
    const { metadata } = splitFrontmatter(content)

    const sections = extractSectionsFromMarkdown({
      path: current,
      content,
    })

    documents.push({
      path: current,
      title: await buildDocumentTitle(current),
      metadata,
      sections,
    })

    const documentEdges = await extractSkillLinksFromMarkdown({
      path: current,
      content,
    })

    for (const edge of documentEdges) {
      edges.push(edge)
      if (!visited.has(edge.to)) {
        queue.push(edge.to)
      }
    }
  }

  return {
    root: normalize(resolve(rootPath)),
    documents,
    edges,
  }
}

export const getSkillLinks: ToolHandler = async (args, ctx) => {
  const input = SkillLinksInputSchema.parse(args)
  const fullPath = input.path.startsWith('/') ? input.path : resolve(ctx.workspace, input.path)
  return await buildSkillEncodingSurface(fullPath)
}

export const skillLinksRiskTags = [RISK_TAG.workspace]

export const skillLinksToolDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'skill_links',
    description:
      'Extract a deterministic section/provenance surface from a SKILL.md or markdown doc, including linked markdown files.',
    parameters: z.toJSONSchema(SkillLinksInputSchema) as ToolDefinition['function']['parameters'],
  },
}

export const skillLinksCli = async (args: string[]) => {
  if (args.includes('--help') || args.includes('-h')) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log(`plaited skill-links
Extract deterministic section and link surfaces from a skill/doc.

Usage: plaited skill-links '<json>' [options]
       echo '<json>' | plaited skill-links

Input (JSON):
  path    string   Path to SKILL.md or another markdown file

Options:
  --schema <input|output>  Print JSON Schema and exit
  -h, --help               Show this help`)
    return
  }

  const input = await parseCli(args.length === 0 && process.stdin.isTTY ? ['{}'] : args, SkillLinksInputSchema, {
    name: 'skill-links',
    outputSchema: SkillLinksOutputSchema,
  })

  const fullPath = input.path.startsWith('/') ? input.path : resolve(process.cwd(), input.path)
  const output = await buildSkillEncodingSurface(fullPath)
  // biome-ignore lint/suspicious/noConsole: CLI output
  console.log(JSON.stringify(output, null, 2))
}
