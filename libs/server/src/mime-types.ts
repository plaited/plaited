const types = {
  js: 'application/javascript',
  mjs: 'application/javascript',
  json: 'application/json',
  map: 'application/json',
  json5: 'application/json5',
  jsonml: 'application/jsonml+json',
  jsonld: 'application/ld+json',
  svg: 'image/svg+xml',
  xml: 'application/xml',
  css: 'text/css',
  html: 'text/html',
  htm: 'text/html',
} as const

export const mimeTypes = (ext: keyof typeof types) => types[ext] || 'application/octet-stream'
