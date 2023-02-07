// -- std --
export {
  type ConnInfo,
  serve,
  serveTls,
} from 'https://deno.land/std@0.175.0/http/mod.ts'
export { serveDir } from 'https://deno.land/std@0.175.0/http/file_server.ts'
export { walk } from 'https://deno.land/std@0.175.0/fs/mod.ts'
export {
  dirname,
  extname,
  relative,
} from 'https://deno.land/std@0.175.0/path/mod.ts'

// -- brotli --
export { compress } from 'https://deno.land/x/brotli@0.1.7/mod.ts'

// -- playwright --
export { type Page } from 'https://esm.sh/playwright@1.30.0'
export { type Expect } from 'https://esm.sh/@playwright/test@1.30.0'

// -- rutt --
export * as rutt from 'https://deno.land/x/rutt@0.0.14/mod.ts'

// -- esbuild --
// @deno-types="https://deno.land/x/esbuild@v0.14.51/mod.d.ts"
export * as esbuild from 'https://deno.land/x/esbuild@v0.17.5/mod.js'

export { denoPlugin } from 'https://deno.land/x/esbuild_deno_loader@0.6.0/mod.ts'

// -- JSS --
export { create as createJSS, type Styles } from 'https://esm.sh/jss@10.9.2'
export { default as nestedJSS } from 'https://esm.sh/jss-plugin-nested@10.9.2'
export { default as camelJSS } from 'https://esm.sh/jss-plugin-camel-case@10.9.2'
export { default as globalJSS } from 'https://esm.sh/jss-plugin-global@10.9.2'

// -- PostCSS --
export { default as postcss } from 'https://deno.land/x/postcss@8.4.16/mod.js'
// @deno-types="https://deno.land/x/postcss_combine_duplicated_selectors@10.0.5/mod.d.ts"
export { default as combineDuplicatedSelectors } from 'https://deno.land/x/postcss_combine_duplicated_selectors@10.0.5/mod.js'

// -- lodash --
export {
  camelCase,
  kebabCase,
} from 'https://raw.githubusercontent.com/lodash/lodash/4.17.21-es/lodash.js'
