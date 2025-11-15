/**
 * Creates a Response for serving content, optionally with gzip compression.
 * Used for bundled JavaScript files and static content.
 *
 * @param content - The content to serve
 * @param contentType - MIME type of the content
 * @param compress - Whether to gzip compress the content (default: false for faster test performance)
 * @returns Response with content (compressed if enabled)
 *
 * @internal
 */
export const zip = ({
  content,
  contentType,
  compress = false,
}: {
  content: string
  contentType: string
  compress?: boolean
}) => {
  if (!compress) {
    return new Response(content, {
      headers: new Headers({
        'content-type': contentType,
      }),
    })
  }

  const compressed = Bun.gzipSync(content)
  return new Response(compressed as BodyInit, {
    headers: new Headers({
      'content-type': contentType,
      'content-encoding': 'gzip',
    }),
  })
}
