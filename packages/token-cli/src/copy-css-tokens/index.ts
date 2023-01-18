import path from 'path'
import fs from 'fs/promises'

export const copyCssTokens = async (stylesheet:string, dir: string) => {
  const output = path.resolve(process.cwd(), dir)
  await fs.mkdir(output, { recursive: true })
  const outputFilePath = path.resolve(output, path.basename(stylesheet))
  try {
    const exist = await fs.stat(outputFilePath)
    exist && await fs.rm(outputFilePath)
    await fs.copyFile(stylesheet, outputFilePath)
  } catch (err) {
    console.error(err)
  }
}
