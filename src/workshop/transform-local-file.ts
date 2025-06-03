import { zip } from './zip.js'

const H = 'h'
const jsxRuntime = `import { ${H} } from "plaited/jsx-runtime"\n`
const jsxRuntimeIdentifier = 'jsxDEV_7x81h0kn'

export const transformLocalFile = async (path: string) => {
  const file = Bun.file(path)
  const exist = await file.exists()
  if (!exist) {
    return new Response(`File not found: ${path}`, { status: 404 })
  }
  const code = await file.text()
  const transpiler = new Bun.Transpiler({
    loader: 'tsx',
    tsconfig: JSON.stringify({
      compilerOptions: {
        jsx: 'react-jsx',
        jsxFactory: 'h',
        jsxFragmentFactory: 'Fragment',
        jsxImportSource: 'plaited',
      },
    }),
  })
  const result = transpiler.transformSync(code)
  const hasJSXRuntime = result.includes('jsxDEV_7x81h0kn')
  const toRet = hasJSXRuntime ? jsxRuntime + result.replaceAll(jsxRuntimeIdentifier, H) : result
  return zip(toRet)
}
