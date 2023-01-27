import { getStat } from 'src/shared/get-stat.js'
import { assetsDir } from './constants.js'
import { copyFolder } from 'src/tiering-util/copy-folder.js'
import fs from 'fs/promises'

export const copyAssets =  async (source: string) => {
  const exist = await getStat(assetsDir)
  try {
    exist && await fs.rm(assetsDir, { recursive: true })
  } catch(err) {
    console.error(err)
  }
  await copyFolder(assetsDir, source)
}
