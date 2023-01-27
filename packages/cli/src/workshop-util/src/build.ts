import fs from 'fs/promises'
import { copyFolder } from 'src/tiering-util/copy-folder.js'
import { getStat } from 'src/shared/get-stat.js'
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
  const exist = await getStat(output)
  try {
    exist && await fs.rm(output, { recursive: true })
    fs.mkdir(output, { recursive: true })
    fs.writeFile(`${output}/package.json`, packageTemplate)
  } catch(err) {
    console.error(err)
  }
  await copyFolder(output, root)
}


