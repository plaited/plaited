/**
 * Creates a gzip-compressed Response for serving content.
 * Used for bundled JavaScript files and static content.
 *
 * @param content - The content to compress
 * @param contentType - MIME type of the content
 * @returns Response with gzip-compressed content
 *
 * @internal
 */
export const zip = ({ content, contentType }: { content: string; contentType: string }) => {
  const compressed = Bun.gzipSync(content)
  return new Response(compressed as BodyInit, {
    headers: new Headers({
      'content-type': contentType,
      'content-encoding': 'gzip',
    }),
  })
}
