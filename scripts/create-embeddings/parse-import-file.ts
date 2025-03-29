import { Ollama } from 'ollama'
import { embeddingModels } from './create-embeddings.constants.js'

import { generateBlockEmbeddings, type Block } from './generate-embeddings'
import { EMBEDDING_MODELS } from './create-embeddings.constants'

export const parseImportFile = async (filePath: string, source: string) => {
  // const codeLines = traverse(ast)
  // const codeString = codeLines.join('\n')
  // return await generateEmbedding(codeString)
  return {
    ast,
    imports,
    exports,
    source,
    embeddings,
  }
}
