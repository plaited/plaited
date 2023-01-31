const types = {
  'application/javascript': ['js', 'mjs'],
  'application/json': ['json', 'map'],
  'application/json5': ['json5'],
  'application/jsonml+json': ['jsonml'],
  'application/ld+json': ['jsonld'],
  'image/svg+xml': ['svg'],
  'application/xml': ['xml'],
  'text/css': ['css'],
  'text/html': ['html', 'htm'],
}

const mimes: Record<string, string> = Object.entries(types).reduce(
  (all, [type, exts]) =>
    Object.assign(all, ...exts.map((ext) => ({ [ext]: type }))),
  {},
)

export const mimeTypes = (ext: string) =>
  mimes[ext] || 'application/octet-stream'

export const toCompress = Object.values(types).flatMap((value) => value)
