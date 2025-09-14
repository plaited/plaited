import type { ZipParams } from '../mcp.schemas.js'

export const zip = ({ content, contentType, headers }: ZipParams) => {
  const compressed = Bun.gzipSync(content)
  const defaultHeaders: Record<string, string> = {
    'content-type': contentType,
    'content-encoding': 'gzip',
  }
  if (headers) {
    for (const key in defaultHeaders) {
      headers.append(key, defaultHeaders[key])
    }
  }
  return new Response(compressed as BodyInit, {
    headers: headers ?? defaultHeaders,
  })
}
