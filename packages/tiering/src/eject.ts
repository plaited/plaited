import { appendEjection } from './append-ejection.js'
import { copyComponent } from './copy-component.js'
import { getTargetExport } from './get-target-export.js'

export const eject =  async ({
  target, source, packageName,
}:{
  target: string, source: string, packageName: string
}) => {
  const comp = await copyComponent(target, source)
  return await appendEjection({ targetExport: getTargetExport(target), components: [ comp ], packageName })
}
