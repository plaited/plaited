// -- std --
export {
  type ConnInfo,
  serve,
  serveTls,
} from 'https://deno.land/std@0.175.0/http/mod.ts'
export { serveDir } from 'https://deno.land/std@0.175.0/http/file_server.ts'
export { walk } from 'https://deno.land/std@0.175.0/fs/mod.ts'
export {
  basename,
  dirname,
  extname,
  relative,
  resolve,
  toFileUrl,
} from 'https://deno.land/std@0.175.0/path/mod.ts'

// -- brotli --
export { compress } from 'https://deno.land/x/brotli@0.1.7/mod.ts'

// -- playwright --
export { type Page } from 'https://esm.sh/playwright@1.30.0'
export { type Expect } from 'https://esm.sh/@playwright/test@1.30.0'

// -- rutt --
export * as rutt from 'https://deno.land/x/rutt@0.0.14/mod.ts'

// -- esbuild --
export * as esbuild from 'https://deno.land/x/esbuild@v0.17.6/mod.js'
export { denoPlugin } from 'https://deno.land/x/esbuild_deno_loader@0.6.0/mod.ts'

// -- PostCSS --
export { default as postcss } from 'https://deno.land/x/postcss@8.4.16/mod.js'
// @deno-types="https://deno.land/x/postcss_combine_duplicated_selectors@10.0.5/mod.d.ts"
export { default as combineDuplicatedSelectors } from 'https://deno.land/x/postcss_combine_duplicated_selectors@10.0.5/mod.js'

// -- lodash --
export {
  camelCase,
  kebabCase,
} from 'https://raw.githubusercontent.com/lodash/lodash/4.17.21-es/lodash.js'
