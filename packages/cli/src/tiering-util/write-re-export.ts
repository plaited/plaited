import fs  from 'fs/promises'
import { getComponentDirs } from './get-component-dirs.js'
import { reExportTemplate } from './templates.js'
import { getTargetExport } from './get-target-export.js'
export const writeReExport = async ({
  target, source, packageName,
}: {
  target: string, source: string, packageName: string
}) => {
  await fs.mkdir(target, { recursive: true })
  const targetExport = getTargetExport(target)
  const dirs = await getComponentDirs(source)
  await fs.writeFile(
    targetExport,
    dirs.map((comp: string) => reExportTemplate(comp, packageName)).join('\n')
  )
}
