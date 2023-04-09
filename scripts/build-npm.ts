import { assert, walk } from '../libs/dev-deps.ts'

import { bundler } from './bundler.ts'

const root = Deno.cwd()
const outdir = `${root}/npm`

await Deno.mkdir(outdir, { recursive: true })

// Cleanup old generated files
for await (
  const entry of walk(outdir, {
    exts: ['.js'],
  })
) {
  assert(entry.isFile)
  await Deno.remove(entry.path)
}

const entryPoints = [`${root}/mod.ts`, `${root}/jsx-runtime.ts`]

// Bundle libs
const unminified = await bundler({
  entryPoints,
  outdir,
  minify: false,
})

const minified = await bundler({
  entryPoints,
  outdir,
  minify: true,
  entryNames: '[dir]/[name].min',
})

const config = {
  'name': 'plaited',
  'version': Deno.args[0],
  'description':
    'Rapidly code and refine web applications as requirements change and evolve.',
  'license': 'ISC',
  'type': 'module',
  'repository': {
    'type': 'git',
    'url': 'git+https://github.com/plaited/plaited.git',
  },
  'bugs': {
    'url': 'https://github.com/plaited/plaited/issues',
  },
  'exports': {
    '.': './mod.js',
    './jsx-runtime': './jsx-runtime.js',
  },
}

// Write package.json
await Deno.writeTextFile('npm/package.json', JSON.stringify(config, null, 2))

console.log(
  `unminified size: ${unminified.outputs['npm/mod.js'].bytes / 1024} KiB
minified size: ${minified.outputs['npm/mod.min.js'].bytes / 1024} KiB`,
)
