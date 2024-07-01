import Bun, { BuildArtifact } from 'bun'

export const gzipContentTypes = new Set(['text/javascript;charset=utf-8', 'application/json;charset=utf-8'])

const isHDA = (str: string) => {
  const regex = /^\.\.\/.*\/hda\.ts$/
  return regex.test(str)
}

const getResponse = (str: string, type: string) => {
  const compressed = Bun.gzipSync(Buffer.from(str))
  return new Response(compressed, {
    headers: {
      'content-type': type,
      'content-encoding': 'gzip',
    },
  })
}

export const jsHandlers = async (outputs: BuildArtifact[]) => {
  const handlers = new Map<string, () => Response>()
  await Promise.all(
    outputs.map(async (output) => {
      const { type } = output
      if (gzipContentTypes.has(type)) {
        const str = await output.text()
        const { path } = output
        const formattedPath =
          isHDA(path) ? '/hda.js'
          : path.startsWith('./') ? path.slice(1)
          : `/${path}`
        handlers.set(formattedPath, () => getResponse(str, type))
      }
    }),
  )
  return handlers
}