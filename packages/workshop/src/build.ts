import fs from 'fs/promises'
import { getStat, copyFolder } from '@plaited/node-utils'
import { WorkshopConfig } from './types.js'
import { assetsDir,root, worksDirectoryFile, copyAssets } from './utils/index.js'
import { write } from './write/index.js'

const indexTemplate = `const { server } = await import('@plaited/server')
const { getRoutes } = await import('@plaited/workshop')
const { workFiles } = await import('${worksDirectoryFile}')
const routes = await getRoutes(workFiles)
await server({
  reload = false,
  routes,
  root: ${assetsDir},
})`

const packageTemplate = `{
  "engines": {
    "node": ">= v18.12.1"
  },
  "scripts": {
    "start: "node index.js"
  },
  "dependencies": {
    "@plaited/server": "0.0.0",
    "@plaited/workshop": "0.0.0"
  }
}`

export const build = async (output: string, { assets, ...config }: WorkshopConfig) => {
  let exist = await getStat(root)
  exist && await fs.rm(root, { recursive: true })
  const { workFiles } = await write(config)
  try {
    await fs.writeFile(`${worksDirectoryFile}`, `export const workFiles =[
      ${workFiles.join('\n')},
      ]`)
    await fs.writeFile(`${root}/index.js`, indexTemplate)
    assets && await copyAssets(assets)
  } catch(err) {
    console.error(err)
  }
  exist = await getStat(output)
  try {
    exist && await fs.rm(output, { recursive: true })
    await fs.mkdir(output, { recursive: true })
    await fs.writeFile(`${output}/package.json`, packageTemplate)
  } catch(err) {
    console.error(err)
  }
  await copyFolder(output, root)
  await fs.rm(worksDirectoryFile)
}


