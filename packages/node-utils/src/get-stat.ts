import fs from 'fs/promises'

export const getStat = async (source: string) => {
  let exist: Awaited<ReturnType<typeof fs.stat>> | undefined
  try {
    exist = await fs.stat(source)
  } catch (err) {
    exist = undefined
  }
  return exist
}
