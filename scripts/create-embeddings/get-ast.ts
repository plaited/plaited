import ts from 'typescript'

interface AstNode {
  kind: string
  text: string
  children?: AstNode[]
}

function traverse(node: ts.Node): AstNode {
  const astNode: AstNode = {
    kind: ts.SyntaxKind[node.kind],
    text: node.getText(),
  }
  const children = node.getChildren()
  if (children.length > 0) {
    astNode.children = children.map((child) => traverse(child))
  }
  return astNode
}

export const getAst = (source: string, path: string) => {
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  return traverse(sourceFile)
}
