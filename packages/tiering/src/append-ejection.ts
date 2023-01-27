import fs  from 'fs/promises'
import { reExportTemplate, ejectTemplate } from './templates.js'

export const appendEjection = async ({
  targetExport, components, packageName,
}:{
  targetExport: string, components: string[], packageName: string
}) => {
  let content = await fs.readFile(targetExport, { encoding: 'utf8' })
  for (const comp of components) {
    content = content.replace(reExportTemplate(comp, packageName), ejectTemplate(comp))
  }
  return await fs.writeFile(
    targetExport,
    content
  )
}
