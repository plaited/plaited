import path from 'path'
import fs from 'fs/promises'
import { getStat } from '../get-stat.js'
import { getComponentDirs } from './get-component-dirs.js'
import { copyFolder } from './copy-folder.js'

export const copyComponent = async (target:string, source: string) => {
  const choices = await getComponentDirs(source)
  const { default: inquirer } = await import(
    'inquirer'
  )
  const prompt = inquirer.prompt
  const { comp } = await prompt([ {
    type: 'list',
    name: 'comp',
    message: 'Which component would you like to eject?',
    choices,
  } ])
  const targetCompDir = path.resolve(target, comp)
  const exist = await getStat(targetCompDir)
  if(exist) {
    const { overwrite } =  await prompt({
      type: 'confirm',
      name: 'overwrite',
      message: 'Do you wish to overwrite exiting ejection?',
      default: false,
    })
    if(!overwrite) {
      return
    }
    await fs.rm(targetCompDir, { recursive: true })
  }
  await copyFolder(target, path.resolve(source, comp))
  return comp
}
