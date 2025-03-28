import * as tsdoc from '@microsoft/tsdoc'

const getCommentAst = (outputLines: string[], docNode: tsdoc.DocNode, indent: string = ''): void => {
  let ast: string = ''
  if (docNode instanceof tsdoc.DocExcerpt) {
    const content: string = docNode.content.toString()
    ast += `${indent}* ${docNode.excerptKind}=` + JSON.stringify(content)
  } else {
    ast += `${indent}- ${docNode.kind}`
  }
  outputLines.push(ast)
  for (const child of docNode.getChildNodes()) {
    getCommentAst(outputLines, child, indent + '  ')
  }
}

export const getTSDocs = (source: string) => {
  const configuration: tsdoc.TSDocConfiguration = new tsdoc.TSDocConfiguration()
  configuration.addTagDefinition(
    new tsdoc.TSDocTagDefinition({
      tagName: '@sampleCustomBlockTag',
      syntaxKind: tsdoc.TSDocTagSyntaxKind.BlockTag,
    }),
  )
  const tsdocParser: tsdoc.TSDocParser = new tsdoc.TSDocParser(configuration)
  const parserContext: tsdoc.ParserContext = tsdocParser.parseString(source)
  const outputLines: string[] = []
  if (parserContext?.docComment) getCommentAst(outputLines, parserContext.docComment)
  return outputLines.join('\n')
}
