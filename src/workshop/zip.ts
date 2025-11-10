export const zip = ({ content, contentType }: { content: string; contentType: string }) => {
  const compressed = Bun.gzipSync(content)
  return new Response(compressed as BodyInit, {
    headers: new Headers({
      'content-type': contentType,
      'content-encoding': 'gzip',
    }),
  })
}
