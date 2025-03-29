import markdown from 'remark-parse'
import { unified } from 'unified'
import { selectAll } from 'unist-util-select'
import gfm from 'remark-gfm'
import type { RootContent, TableRow, TableCell, Root } from 'mdast'
import { generateBlockEmbeddings, type Block } from './generate-embeddings'
import { EMBEDDING_MODELS } from './create-embeddings.constants'

type LinkNode = {
  type: string
  url: string
  title?: string
}

const processAST = (source: string) => {
  const processor = unified().use(markdown).use(gfm)
  const ast = processor.parse(source)
  return ast
}

const extractTextFromNode = (node: RootContent): string => {
  if (node.type === 'text') {
    return node.value
  }
  if ('children' in node) {
    return node.children.map(extractTextFromNode).join(' ')
  }
  return ''
}

const createMarkdownBlocks = (ast: RootContent | Root): Block[] => {
  const blocks: Block[] = []

  const traverse = (node: RootContent | Root) => {
    if (node.type === 'paragraph') {
      blocks.push({ type: 'paragraph', content: extractTextFromNode(node) })
    } else if (node.type === 'heading') {
      blocks.push({ type: 'heading', content: extractTextFromNode(node) })
    } else if (node.type === 'listItem') {
      blocks.push({ type: 'listItem', content: extractTextFromNode(node) })
    } else if (node.type === 'code') {
      blocks.push({ type: 'code', content: node.value })
    } else if (node.type === 'blockquote') {
      blocks.push({ type: 'blockquote', content: extractTextFromNode(node) })
    } else if (node.type === 'thematicBreak') {
      blocks.push({ type: 'thematicBreak', content: '' }) // Thematic break itself might be a block
    } else if (node.type === 'table') {
      // For tables, we might consider each row or each cell as a block
      // Here, we'll treat the entire table content as one block for simplicity
      let tableContent = ''
      if (node.children) {
        tableContent = node.children
          .map(
            (row: TableRow) => row.children.map((cell: TableCell) => extractTextFromNode(cell)).join('\t'), // Separate cells by tab
          )
          .join('\n') // Separate rows by newline
      }
      blocks.push({ type: 'table', content: tableContent })
    } else if ('children' in node) {
      node.children.forEach(traverse)
    }
  }

  traverse(ast)
  return blocks.filter((block) => block.content.trim() !== '') // Filter out empty blocks
}

const extractLinks = (ast: Root): string[] => {
  // Select all link nodes from the AST
  const linkNodes = selectAll('link', ast) as LinkNode[]
  // Extract and return unique URLs
  return [...new Set(linkNodes.map((node) => node.url))]
}

export const parseMarkdownFile = async (source: string) => {
  const ast = processAST(source)
  const links = extractLinks(ast)
  const blocks = createMarkdownBlocks(ast)
  const embeddings = await generateBlockEmbeddings(EMBEDDING_MODELS.PHI4_MINI, ...blocks)
  return {
    ast,
    links,
    source,
    embeddings,
  }
}
