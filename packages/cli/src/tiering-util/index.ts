import inquirer from 'inquirer'
import path from 'path'
import fs from 'fs/promises'
import { getStat } from '../shared/get-stat.js'
import { writeReExport } from './write-re-export.js'
import { getTargetExport  } from './get-target-export.js'
import { eject } from './eject.js'
import { update } from './update.js'
import { interdependenciesTestTemplate } from './interdependency-test-template.js'

export const tieringUtil = async ({
  output, source, packageName,
}:{
  output: string, source: string, packageName: string
}) => {
  const target = path.resolve(process.cwd(), output)
  const targetExport = getTargetExport(target)
  const reExport = await getStat(targetExport)
  const prompt = inquirer.prompt
  const choices = [ 'eject', 'update' ]
  !reExport && choices.splice(1, 0, 'setup')
  const { action } =  await prompt({
    type: 'list',
    name: 'action',
    message: 'What tiered action do you want?',
    choices,
  })
  if(action === 'eject') {
    !reExport &&  await writeReExport({ target, source, packageName })
    return await eject({ target, source, packageName })
  }
  if(action === 'setup') {
    await fs.writeFile(path.resolve(target, './interdependency.ava.spec.ts'), interdependenciesTestTemplate)
    if(!reExport) return await writeReExport({ target, source, packageName })
  }
  if(action === 'update') {
    if(!reExport) return await writeReExport({ target, source, packageName })
    return await update({ target, source, packageName })
  }
}
