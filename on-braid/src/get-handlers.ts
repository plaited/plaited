import Bun, { BuildArtifact } from 'bun'

export const gzipContentTypes = new Set(['text/javascript;charset=utf-8', 'application/json;charset=utf-8'])

const getResponse = (str: string, type: string) => {
  const compressed = Bun.gzipSync(Buffer.from(str))
  return new Response(compressed, {
    headers: {
      'content-type': type,
      'content-encoding': 'gzip',
    },
  })
}

export const getHandlers = async (outputs: BuildArtifact[]) => {
  const handlers = new Map<string, () => Response>()
  await Promise.all(
    outputs.map(async (output) => {
      const { type } = output
      if (gzipContentTypes.has(type)) {
        const str = await output.text()
        handlers.set(output.path.substring(1), () => getResponse(str, type))
      }
    }),
  )
  return handlers
}
