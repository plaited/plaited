export const zip = ({content, contentType, headers}: {content: string, contentType: string, headers?: Headers}) => {
  const compressed = Bun.gzipSync(content)
  const defaultHeaders: Record<string, string>  = {
      'content-type': contentType,
      'content-encoding': 'gzip',
    }
    if(headers){
      for(const key in defaultHeaders) {
        headers.append(key, defaultHeaders[key])
    }
  }
  return new Response(compressed, {
    headers: headers ?? defaultHeaders,
  })
}