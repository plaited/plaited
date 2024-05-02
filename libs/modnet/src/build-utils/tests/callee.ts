import { RadomComponent } from './__mocks__/_components/random-component.js'
import path from 'node:path'
import { trueTypeOf } from '@plaited/utils'
// const rel = path.relative('/_components/random-component', `./constants.js`);

// console.log({rel})
// const transpiler = new Bun.Transpiler({
//   loader: 'tsx',
// })

// console.log(RadomComponent)
// const router = new Bun.FileSystemRouter({
//   style: 'nextjs',
//   dir: `${import.meta.dir}/__mocks__`,
//   fileExtensions: ['.tsx', '.jsx'],
// })

// console.log(router.routes)
// console.log( Bun.fileURLToPath(new URL(import.meta.url));)
// const cwd = `${import.meta.dir}/__mocks__`
// const glob = new Bun.Glob(`**/_components/**/*.{tsx}`)
// const files = await Array.fromAsync(glob.scan({ cwd }))
// console.log(files)
// const entrypoints = files.map((entry) => `${import.meta.dir}/__mocks__/${entry}`)
// const result = await Bun.build({
//   entrypoints,
//   minify: true,
//   splitting: true,
//   root: cwd,
//   publicPath: '',
// })

const res = new Response()
console.log(trueTypeOf(res))
// const sourcemap = result.outputs.flatMap((output) => output.kind === 'entry-point' ? output : [])[0].sourcemap
// console.log(sourcemap)
// const str = await sourcemap.text()
// console.log(str)

// const first = files[0]
// const foo = Bun.file(`${cwd}/${first}`)
// const code = await foo.text()
// const result = transpiler.scan(code);

// console.log(result)
