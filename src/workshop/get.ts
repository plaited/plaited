import { extname } from 'node:path'
import { globStories } from './glob.ts'
import { mapStoryResponses } from './map.tsx'

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
  return { stories, getResponses }
}

const zip = (content: string) => {
  const compressed = Bun.gzipSync(content)
  return new Response(compressed, {
    headers: {
      'content-type': 'text/javascript;charset=utf-8',
      'content-encoding': 'gzip',
    },
  })
}

const transpiler = new Bun.Transpiler({
  loader: "tsx",
  tsconfig: {
    "compilerOptions": {
      "jsx": "react-jsx",
      "jsxImportSource": "plaited",
      "paths": {
        "plaited/jsx-runtime": [Bun.resolveSync("../jsx/runtime.ts", import.meta.dir)],
        "plaited/jsx-dev-runtime": [Bun.resolveSync("../jsx/dev-runtime.ts", import.meta.dir)]
      }
    },
  }
});

export const getFile = async (path:string ) => {
  const file = Bun.file(path) 
  try {
    const code = await file.text()
    const loader = extname(path).slice(1) === 'tsx' ? 'tsx' : 'ts'
    const result = await transpiler.transform(code, loader)
    return zip(result)
  } catch (error) {
    console.error(error)
  }
}
  