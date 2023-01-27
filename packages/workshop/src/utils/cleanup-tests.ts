import path from 'path'
import fs from 'fs/promises'
import { toId } from './to-id.js'

export const cleanupTests = async (testFiles: string[], specData:{
  title: string
  name: string
  [key:string]: unknown
}[]) => {
  const works = new Set (specData.map(({ title, name }) => toId(title, name)))
  return await Promise.all(testFiles.map(async str => {
    const name = path.basename(str, 'playwright.spec.ts')
    const exist = works.has(name)
    if(exist) return
    return await fs.rm(str)
  }))
}
