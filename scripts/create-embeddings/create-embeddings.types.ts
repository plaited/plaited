export type Block = {
  type: string
  content: string
}

export type EmbeddingObject = {
  block: Block
  embedding: number[]
}
