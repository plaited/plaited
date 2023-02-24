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
} from 'https://esm.sh/lodash-es@4.17.21'

// -- esbuild --
export {
  build,
  type BuildOptions,
  type OutputFile,
  stop,
} from 'https://deno.land/x/esbuild@v0.17.6/mod.js'
export { denoPlugin } from 'https://deno.land/x/esbuild_deno_loader@0.6.0/mod.ts'

// -- parsel --
export * as parsel from 'https://esm.sh/parsel-js@1.0.3'

// -- brotli --
export { compress } from 'https://deno.land/x/brotli@0.1.7/mod.ts'

// -- rutt --
import { Routes as _Routes } from 'https://deno.land/x/rutt@0.1.0/mod.ts'
export {
  type ErrorHandler,
  type Handler,
  type HandlerContext,
  type MatchHandler,
  router,
  type UnknownMethodHandler,
} from 'https://deno.land/x/rutt@0.1.0/mod.ts'

// fix type conflict by passing in unknown
export type Routes<T = unknown> = _Routes<T>

// -- PostCSS --
export { default as postcss } from 'https://deno.land/x/postcss@8.4.16/mod.js'
// @deno-types="https://deno.land/x/postcss_combine_duplicated_selectors@10.0.5/mod.d.ts"
export { default as combineDuplicatedSelectors } from 'https://deno.land/x/postcss_combine_duplicated_selectors@10.0.5/mod.js'

// -- playwright --
export { type Locator } from 'npm:playwright@1.31.0'
export { type Expect } from 'npm:@playwright/test@1.31.0'
