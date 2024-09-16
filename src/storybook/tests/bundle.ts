// import type { BunPlugin } from 'bun';

// const myPlugin: BunPlugin = {
//   name: "my-plugin",
//   setup(builder) {
//     builder.onResolve(
//       { filter: /.*/, },
//       args => {
//         console.log(args);
//         return {
//           paths: './a.plaited',
//           namespace: 'my-plugin',
//         }
//       },
//     );
//   },
// };

// const { logs } = await Bun.build({
//   entrypoints: ['./a.plaited'],
//   minify: true,
//   splitting: true,
//   sourcemap: 'inline',
//   plugins: [myPlugin],
// })

// console.log(logs)

import * as esbuild from 'esbuild'

await esbuild.build({
  entryPoints: ['src/pages/home/index.ts', 'src/pages/about/index.ts'],
  bundle: true,
  outdir: 'out',
  outbase: 'src',
  write: false,
})
