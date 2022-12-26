#! /usr/bin/env node
import path from 'path'
import fs from 'fs/promises'
import fg from 'fast-glob'
import { getStat } from '../get-stat.js'

export const copyCssUtil = async (packageName:string, dir: string) => {
  const output = path.resolve(process.cwd(), dir)
  await fs.mkdir(output, { recursive: true })
  const packagePath = require.resolve(packageName) // or await import.meta.resolve(packageName)
  const stylesheets = await fg([ path.resolve(packagePath, `**/*.css`) ])
  await Promise.all(stylesheets.map(async sheet => {
    const outputFilePath = path.resolve(output, path.basename(sheet))
    const fileExist = await getStat(outputFilePath)
    try {
      fileExist && await fs.rm(outputFilePath)
      await fs.copyFile(sheet, outputFilePath)
    } catch (e) {
      console.error(e)
    }
  }))
}
