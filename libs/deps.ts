// -- std --
export { serveDir } from 'https://deno.land/std@0.181.0/http/file_server.ts'
export {
  type ConnInfo,
  serve,
  serveTls,
} from 'https://deno.land/std@0.181.0/http/server.ts'
export {
  basename,
  dirname,
  extname,
  relative,
  resolve,
  toFileUrl,
} from 'https://deno.land/std@0.181.0/path/mod.ts'

// -- lodash --
export { default as camelCase } from 'npm:lodash-es@4.17.21/camelCase.js'
export { default as kebabCase } from 'npm:lodash-es@4.17.21/kebabCase.js'
export { default as lowerCase } from 'npm:lodash-es@4.17.21/lowerCase.js'
export { default as startCase } from 'npm:lodash-es@4.17.21/startCase.js'

// -- brotli --
export { compress } from 'https://deno.land/x/brotli@0.1.7/mod.ts'
