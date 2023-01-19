import inquirer from 'inquirer'
import { writeReExport } from './write-re-export.js'
import { getTargetExport  } from './get-target-export.js'
import { getEjections } from './get-ejections.js'
import { appendEjection } from './append-ejection.js'

export const update = async ({
  target, source, packageName,
}: {
  target: string, source: string, packageName: string
}) => {
  const prompt = inquirer.prompt
  const { update } =  await prompt({
    type: 'confirm',
    name: 'update',
    message: 'Re-export file exist. Did you want to update the re-export file?',
    default: false,
  })
  if(!update) return
  const ejections = await getEjections(target, packageName)
  if(ejections.length) {
    await writeReExport({ target, source, packageName })
    const { choices } = await prompt({
      // @ts-ignore: ejection.length > 1
      type: 'checkbox',
      name: 'choices',
      message: 'Which ejected components do you want to keep?',
      choices: ejections.map(comp => ({ name: comp })),
      validate(answer) {
        if (answer.length < 1) {
          return 'You must choose at least one component.'
        }

        return true
      },
    })
    await appendEjection({ targetExport: getTargetExport(target), components: choices, packageName })
  
  } else {
    console.error('There are no ejected components in your re-export file')
  }
}
