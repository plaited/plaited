export { walk } from 'https://deno.land/std@0.177.0/fs/mod.ts'
export {
  basename,
  dirname,
  extname,
  relative,
  resolve,
  toFileUrl,
} from 'https://deno.land/std@0.177.0/path/mod.ts'

// -- playwright --
export { type Page } from 'https://esm.sh/playwright@1.30.0'
export { type Expect } from 'https://esm.sh/@playwright/test@1.30.0'

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
  lowerCase,
  startCase,
} from 'https://raw.githubusercontent.com/lodash/lodash/4.17.21-es/lodash.js'

// -- parsel --
export * as parsel from 'https://esm.sh/parsel-js@1.0.3'
