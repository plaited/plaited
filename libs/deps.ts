// -- std --
export { serveDir } from 'https://deno.land/std@0.177.0/http/file_server.ts'
export {
  type ConnInfo,
  serve,
  serveTls,
} from 'https://deno.land/std@0.177.0/http/server.ts'
export { walk } from 'https://deno.land/std@0.177.0/fs/mod.ts'
export {
  basename,
  dirname,
  extname,
  relative,
  resolve,
  toFileUrl,
} from 'https://deno.land/std@0.177.0/path/mod.ts'

// -- lodash --
export {
  camelCase,
  kebabCase,
  lowerCase,
  startCase,
} from 'https://raw.githubusercontent.com/lodash/lodash/4.17.21-es/lodash.js'

// -- esbuild --
export {
  build,
  type BuildOptions,
  type OutputFile,
  stop,
} from 'https://deno.land/x/esbuild@v0.17.6/mod.js'
export { denoPlugin } from 'https://deno.land/x/esbuild_deno_loader@0.6.0/mod.ts'

// -- brotli --
export { compress } from 'https://deno.land/x/brotli@0.1.7/mod.ts'

// -- playwright --
export { type Locator } from 'npm:playwright@1.31.0'
export { type Expect } from 'npm:@playwright/test@1.31.0'
