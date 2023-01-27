export const interdependenciesTestTemplate =`import fs from 'fs'
import path from 'path'
import ts from 'typescript'
import fg from 'fast-glob'
import test from 'ava'
import { fileURLToPath } from 'url'


const __dirname = path.dirname(fileURLToPath(import.meta.url))

let cases: [dir: string, file: string][]
const srcPath = path.resolve(__dirname)
test.before(async () => {
  const componentDirectories: string[] = []
  const files = await fs.promises.readdir(srcPath, { withFileTypes: true })
  files.forEach(file => {
    file.isDirectory() && componentDirectories.push(file.name)
  })

  cases = componentDirectories.flatMap(dir => {
    const files = fg.sync([ path.resolve(srcPath, dir, '**/*.(ts|tsx)') ], { dot: true })
    return files.map((file): [dir: string, file: string] => ([ dir, file ]))
  })
  return
})

test('Check for component interdependencies', async t => {
  await Promise.all(cases.map(async ([ dir, file ]) => {
    // Parse TS file
    const node = ts.createSourceFile(
      path.basename(file),   
      fs.readFileSync(file, 'utf8'), 
      ts.ScriptTarget.Latest 
    )
      
    // List of local imported  modules
    const modules: {file: string, text: string, absolutePath: string}[] = []

    node.forEachChild(child => {
      if (
        ts.SyntaxKind[child.kind] === 'ImportDeclaration' || // check imports
              ts.SyntaxKind[child.kind] === 'ExportDeclaration' // check exports
      ) {
        //@ts-ignore: not sure why this is missing from ImportDeclaration and ExportDeclaration
        const text: string = child.moduleSpecifier.text
        text.startsWith('.')  &&  // If it starts with a '.' it's a local module
            modules.push({
              file,
              absolutePath: path.resolve(path.dirname(file), text),
              text,
            })
      }
    })

    const pathStart = path.resolve(srcPath, dir)
    const results = modules.find(mod => !mod.absolutePath.startsWith(pathStart))
    
    t.falsy(results, \`Expected no interdependencies but found \${JSON.stringify(results, null, 2)}\`)
  }))
})`

