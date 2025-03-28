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

export const parseStoryFile = async (filePath: string, source: string) => {
  // const codeLines = traverse(ast)
  // const codeString = codeLines.join('\n')
  // return await generateEmbedding(codeString)
}
