export const jsMimeTypes = ['text/javascript;charset=utf-8', 'application/json;charset=utf-8'] as const

export const isJsMimeType = (type: string): type is (typeof jsMimeTypes)[number] =>
  jsMimeTypes.includes(type as (typeof jsMimeTypes)[number])

export const zip = (content: string, type: (typeof jsMimeTypes)[number]) => {
  const compressed = Bun.gzipSync(content)
  return new Response(compressed, {
    headers: {
      'content-type': type,
      'content-encoding': 'gzip',
    },
  })
}
