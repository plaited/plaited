import ts from 'typescript'
import { Ollama } from 'ollama'
import { embeddingModels } from './create-embeddings.constants.js'

const generateEmbedding = async (code: string) => {
  const ollama = new Ollama({})
  try {
    const response = await ollama.embeddings({
      model: embeddingModels.ts,
      prompt: code,
    })
    return response.embedding
  } catch (error) {
    console.error('Error generating embeddings:', error)
  }
}

const traverse = (node: ts.Node, depth = 0, codeLines: string[] = []): string[] => {
  const indent = '  '.repeat(depth)
  codeLines.push(`${indent}${ts.SyntaxKind[node.kind]}: ${node.getText()}`)
  ts.forEachChild(node, (childNode) => {
    traverse(childNode, depth + 1, codeLines)
  })
  return codeLines
}

export const tsToEmbedding = async (ast: ts.SourceFile): Promise<number[] | undefined> => {
  const codeLines = traverse(ast)
  const codeString = codeLines.join('\n')
  return await generateEmbedding(codeString)
}
