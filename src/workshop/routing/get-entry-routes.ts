import { basename, dirname } from 'node:path'
import { zip } from "./zip.js"
import { kebabCase } from '../../utils/case.js'

export const getEntryRoutes = async (cwd: string, entrypoints: string[]) => {
  const responses: {
    [key: string]: Response
  } = {}
  const { outputs } = await Bun.build({
    entrypoints,
    splitting: true,
    root: cwd,
    // minify: true,
    sourcemap: 'inline',
  })
  await Promise.all(outputs.map(async artifact =>{
    const path = artifact.path
    const content = await artifact.text()
    const{ kind } = artifact
    let formattedPath: string = path
    if(kind === 'entry-point') {
      const base = basename(path, '.stories.js')
      const dir = dirname(path)
      formattedPath = `/${dir}/${kebabCase(base)}--index.js`
    } else if(path.startsWith('.')) {
      formattedPath = path.replace(/^\./, '')
    }
    Object.assign(responses, {
      [formattedPath]: zip({
        content,
        contentType: artifact.type
      })
    })
  }))
  return responses
}