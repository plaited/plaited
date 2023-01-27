import fs  from 'fs/promises'
import { getTargetExport } from './get-target-export.js'

export const getEjections = async (target: string, packageName:string) => {
  const targetExport = getTargetExport(target)
  const ejections: string[] = []
  const content = await fs.readFile(targetExport, { encoding:'utf-8' })
  const arr = content.split('\n')
  for(const str of arr) {
    if(!str.includes(packageName)) {
      const comp = str.match(/(?:export \* from '|")(?:\.\/)(.*?)(?:'|")/)
      comp && ejections.push(comp[1])
    }
  }
  return ejections
}
