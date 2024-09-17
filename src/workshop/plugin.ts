// import type { BunPlugin } from "bun";
// import { basename } from "path";
// import { TEMPLATE_FILE_REGEX, WORKER_FILE_REGEX } from "./workshop.constants.js";
// import { isPlaitedTemplate } from  './is-plaited-template.js'

// const transpiler = new Bun.Transpiler({
//   loader: 'tsx',
// })

// const registry = new Map<string, { filePath: string; exportName: string }>()

// const getImports = async (templatePaths: { path: string; kind: string }[]) => {
//   const imports = new Set<string>()
//   await Promise.all(
//     templatePaths.map(async ({ path: filePath }) => {
//       try {
//         const modules = await import(filePath)
//         for (const exportName of modules) {
//           const mod = modules[exportName]
//           if (!mod || !isPlaitedTemplate(mod)) continue
//           if (registry.has(mod.tag)) {
//             console.error(
//               `Error ${mod.tag} is already registered ${registry.get(mod.tag)?.exportName}@${registry.get(mod.tag)}\n Change tag name of ${exportName}@${filePath}`,
//             )
//             return
//           } else {
//             registry.set(mod.tag, { filePath, exportName })
//             imports.add(filePath)
//           }
//         }
//       } catch (err) {
//         console.error(err)
//       }
//     }),
//   )
//   return imports
// }

// export const workshopPlugin: BunPlugin = {
//   name: "workshop plugin",
//   setup(build) {
//     build.onLoad({ filter: TEMPLATE_FILE_REGEX }, async ({ path }) => {

//       const file = Bun.file(path)
//       const code = await file.text()
//       const result = transpiler.scanImports(code)
//       const imports = await getImports(result)
//       let contents = ''
//       for (const entry of imports) {
//         contents += `export * from '${entry}';\n`
//       }
//       return { contents: 'str', loader: 'tsx' }
//     })
//   },
// };
