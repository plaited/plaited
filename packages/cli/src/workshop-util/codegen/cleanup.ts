import path from 'path'
import fs from 'fs/promises'

export const cleanup = async (testPaths: string[], flattenedWorks:[string, {
  route: () => string;
  title: string;
  name: string;
}][]) => {
  const works = Object.keys(flattenedWorks).map(([ key ]) => key.replace('/', ''))
  return await Promise.all(testPaths.map(async str => {
    const name = path.basename(str, '.spec.ts')
    const exist = works.includes(name)
    if(exist) return
    return await fs.rm(str)
  }))
}
