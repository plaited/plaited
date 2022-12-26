/**
 * Fork of https://stackoverflow.com/questions/13786160/copy-folder-recursively-in-node-js
 */

import fs from 'fs/promises'
import path from 'path'
import { getStat } from '../get-stat.js'

const copyFiles = async (target: string, source:string) => {
  let targetFile = target
  const exist = await getStat(target)

  // If target is a directory, a new file with the same name will be created
  if(exist?.isDirectory()) {
    targetFile = path.join(target, path.basename(source))
  }

  try {
    const contents = await fs.readFile(source)
    return await fs.writeFile(targetFile, contents)
  } catch(err) {
    console.error(err)
    return
  }
}

export const copyFolder = async (target: string, source:string) => {
  let files = []

  // Check if folder needs to be created or integrated
  const targetFolder = path.join(target, path.basename(source))
  try {
    await fs.mkdir(targetFolder, { recursive: true })
  
    // Copy
    const exist = await getStat(source)
    if (exist?.isDirectory()) {
      files = await fs.readdir(source)
      await Promise.all(files.map(async file => {
        const currentSource = path.join(source, file)
        const currentExist = await getStat(currentSource)
        if (currentExist?.isDirectory()) {
          return await copyFolder(targetFolder, currentSource)
        } else {
          return await copyFiles(targetFolder, currentSource)
        }
      }))
    }
  } catch (err) {
    console.error(err)
  }
}
