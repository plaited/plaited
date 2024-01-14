import Bun from 'bun'
import { extname } from 'node:path'
import { camelCase } from '@plaited/utils'
import { Bundles } from './types.js'
import { mimeTypes } from './mime-types.js'
import { isPlaitedComponent } from './type-guards.js'

const modTemplate = ({ modulePath, tag, name }: { modulePath: string; tag: string; name: string }) => {
  const moduleName = name === 'default' ? camelCase(tag) : `{${name}}`
  return `import ${moduleName} from  '${modulePath}'\n${moduleName}.define()`
}

const getResponse = (str: string) => {
  const compressed = Bun.gzipSync(Buffer.from(str))
  return new Response(compressed, {
    headers: {
      'content-type': mimeTypes('js'),
      'content-encoding': 'gzip',
    },
  })
}

export const getHandlerMap = async ({ outputs, __dirname }: Bundles) => {
  const handlers = new Map<string, () => Response>()
  await Promise.all(
    outputs.map(async (output) => {
      if ('kind' in output) {
        const str = await output.text()
        handlers.set(output.path, () => getResponse(str))
      } else {
        const { path, loader } = output
        const modulePath = path.replace(extname(path), `.${loader}`)
        try {
          const modules = await import(Bun.resolveSync(modulePath, __dirname))
          for (const [name, mod] of Object.entries(modules)) {
            if (isPlaitedComponent(mod)) {
              const tag = mod.tag
              const str = modTemplate({ modulePath, tag, name })
              handlers.set(`./${tag}`, () => getResponse(str))
            }
          }
        } catch (err) {
          console.error(err)
        }
      }
    }),
  )
  return handlers
}
