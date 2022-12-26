export const importJson = async <T = Record<string, never>>(tokensFilePath: string): Promise<T> => {
  const { default: obj } = await import(
    tokensFilePath,
    { assert: { type: 'json' } }
  )
  return obj
}
