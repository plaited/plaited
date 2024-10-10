import { transform } from '@swc/core'
import { globStories } from './glob.js'
import { mapStoryResponses } from './map.js'
import { SION_ROUTE } from './workshop.constants.js'

const zip = (content: string) => {
  const compressed = Bun.gzipSync(content)
  return new Response(compressed, {
    headers: {
      'content-type': 'text/javascript;charset=utf-8',
      'content-encoding': 'gzip',
    },
  })
}

export const getStories = async (cwd: string, websocketUrl: `/${string}`) => {
  const storyEntries = await globStories(cwd)
  const responseMap: Map<string, Response> = new Map()
  const getResponses = () => {
    const toRet: Record<string, Response> = {}
    for (const [path, response] of responseMap) {
      toRet[path] = response.clone()
    }
    return toRet
  }
  const stories = await mapStoryResponses({ storyEntries, responseMap, cwd, websocketUrl })
  const { outputs } = await Bun.build({
    entrypoints: ['sinon'],
  })
  const sinon = await outputs[0].text()
  responseMap.set(SION_ROUTE, zip(sinon))
  return { stories, getResponses }
}

export const getFile = async (path: string) => {
  const file = Bun.file(path)
  try {
    const text = await file.text()
    const { code } = await transform(text, {
      filename: path,
      // sourceMaps: 'inline',
      jsc: {
        target: 'es2022',
        parser: {
          syntax: 'typescript',
          tsx: true,
        },
        transform: {
          react: {
            runtime: 'automatic',
            importSource: 'plaited',
          },
        },
      },
    })
    return zip(code)
  } catch (error) {
    console.error(error)
  }
}
