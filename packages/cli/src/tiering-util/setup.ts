import path from 'path'
import fs from 'fs/promises'
import { writeReExport } from './write-re-export.js'
import { interdependenciesTestTemplate } from './interdependency-test-template.js'

export const setup = async({
  target, source, cliName, packageName,
}:{
  target: string, source: string, cliName: string, packageName: string
}) => {
  await fs.writeFile(path.resolve(target, './interdependency.ava.spec.ts'), interdependenciesTestTemplate)
  await writeReExport({ target, source, packageName })
  try {
    const { default: sourcePackageJson } = await import(
      path.resolve(source, '../package.json'),
      { assert: { type: 'json' } }
    )
    const { default: targetPackageJson } = await import(
      path.resolve(target, '../package.json'),
      { assert: { type: 'json' } }
    )

    const setupPackageJson = {
      ...sourcePackageJson,
      name: targetPackageJson.name,
      version: targetPackageJson.version,
      scripts: {
        ...sourcePackageJson.scripts,
        'tiered-cli': `${cliName} -o src`,
      },
      dependencies: {
        [packageName]: targetPackageJson.dependencies[ packageName],
      },
    }
    await fs.writeFile(path.resolve(target, '../package.json'), JSON.stringify(setupPackageJson, null, 2))
  } catch (err) {
    console.error(err)
  }
}
