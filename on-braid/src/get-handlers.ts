import Bun, { BuildArtifact } from 'bun'

export const gzipContentTypes = new Set([
  'text/javascript;charset=utf-8',
  'text/javascript;charset=utf-8',
  'application/json;charset=utf-8',
  'application/json5;charset=utf-8',
  'application/ld+json;charset=utf-8',
  'image/svg+xml;charset=utf-8',
  'application/xml;charset=utf-8',
  'text/css;charset=utf-8',
  'text/html;charset=utf-8',
  'text/html;charset=utf-8',
])

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
      } else {
        handlers.set(output.path.substring(1), () => new Response(output))
      }
    }),
  )
  return handlers
}
