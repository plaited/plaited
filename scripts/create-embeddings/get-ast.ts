import ts from 'typescript'
import { TSDocParser } from '@microsoft/tsdoc'

interface DocComment {
  summary?: string
  params?: Array<{ name: string; description: string }>
  returns?: string
  example?: string
  remarks?: string
  deprecated?: string
  // Add other TSDoc tags as needed
}

interface AstNode {
  kind: string
  text: string
  children?: AstNode[]
}

const tsdocParser = new TSDocParser()

function parseTSDoc(comment: string): DocComment | undefined {
  // Remove comment markers
  const cleanText = comment
    .replace(/\/\*\*|\*\/|\*/g, '') // Remove /** */ and *
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim()

  if (!cleanText) return undefined

  const { docComment } = tsdocParser.parseString(cleanText)

  const parsedComment: DocComment = {}

  // Parse summary
  if (docComment.summarySection) {
    parsedComment.summary = docComment.summarySection.text.trim()
  }

  // Parse @param tags
  const params = docComment.params.blocks
  if (params.length > 0) {
    parsedComment.params = params.map((param) => ({
      name: param.parameterName,
      description: param.content.toString().trim(),
    }))
  }

  // Parse @returns tag
  if (docComment.returnsBlock) {
    parsedComment.returns = docComment.returnsBlock.content.toString().trim()
  }

  // Parse @example tag
  const exampleBlock = docComment.customBlocks.find((block) => block.blockTag.tagName === '@example')
  if (exampleBlock) {
    parsedComment.example = exampleBlock.content.toString().trim()
  }

  // Parse @remarks tag
  if (docComment.remarksBlock) {
    parsedComment.remarks = docComment.remarksBlock.content.toString().trim()
  }

  // Parse @deprecated tag
  const deprecatedBlock = docComment.customBlocks.find((block) => block.blockTag.tagName === '@deprecated')
  if (deprecatedBlock) {
    parsedComment.deprecated = deprecatedBlock.content.toString().trim()
  }

  return Object.keys(parsedComment).length > 0 ? parsedComment : undefined
}

function getNodeComments(node: ts.Node, sourceFile: ts.SourceFile) {
  const leadingComments: string[] = []
  const trailingComments: string[] = []
  let docComment: DocComment | undefined

  const nodeStart = node.getFullStart()
  const nodeEnd = node.getEnd()
  const fullText = sourceFile.getFullText()

  // Get leading comments
  let commentRanges = ts.getLeadingCommentRanges(fullText, nodeStart)
  if (commentRanges) {
    commentRanges.forEach((range) => {
      const comment = fullText.substring(range.pos, range.end).trim()
      if (comment.startsWith('/**')) {
        // Parse TSDoc comment
        docComment = parseTSDoc(comment)
      } else {
        leadingComments.push(comment)
      }
    })
  }

  // Get trailing comments
  commentRanges = ts.getTrailingCommentRanges(fullText, nodeEnd)
  if (commentRanges) {
    trailingComments.push(...commentRanges.map((range) => fullText.substring(range.pos, range.end).trim()))
  }

  return { leadingComments, trailingComments, docComment }
}

function traverse(node: ts.Node, sourceFile: ts.SourceFile): AstNode {
  const { leadingComments, trailingComments, docComment } = getNodeComments(node, sourceFile)

  const astNode: AstNode = {
    kind: ts.SyntaxKind[node.kind],
    text: node.getText(),
    ...(leadingComments.length && { leadingComments }),
    ...(trailingComments.length && { trailingComments }),
    ...(docComment && { docComment }),
  }

  const children = node.getChildren()
  if (children.length > 0) {
    astNode.children = children.map((child) => traverse(child, sourceFile))
  }

  return astNode
}

export const getAst = (source: string, path: string) => {
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  return traverse(sourceFile, sourceFile)
}
