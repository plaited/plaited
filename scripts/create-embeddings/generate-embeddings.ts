import { Ollama } from 'ollama'

export type Block = {
  type: string
  content: string
}

export type EmbeddingObject = {
  block: Block
  embedding: number[]
}

// Function to generate embeddings from blocks of content
export const generateBlockEmbeddings = async (model: string, ...blocks: Block[]): Promise<EmbeddingObject[]> => {
  const embeddings = []
  const ollama = new Ollama()

  try {
    for (const block of blocks) {
      const response = await ollama.embeddings({
        model,
        prompt: block.content,
      })
      embeddings.push({ block, embedding: response.embedding })
    }
  } catch (error) {
    console.error('Error generating embeddings:', error)
  }

  return embeddings
}
